$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root "data"
$uploadDir = Join-Path $root "uploads"
$dbPath = Join-Path $dataDir "db.json"
$port = 8080

function Ensure-Storage {
  if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
  if (-not (Test-Path $uploadDir)) { New-Item -ItemType Directory -Path $uploadDir | Out-Null }
  if (-not (Test-Path $dbPath)) {
    @{
      users = @()
      stories = @()
      posts = @()
      reels = @()
      taggedPosts = @()
      notifications = @()
      conversations = @()
      sessions = @{}
    } | ConvertTo-Json -Depth 20 | Set-Content -Path $dbPath -Encoding UTF8
  }
}

function Read-Db { Get-Content -Raw -Path $dbPath | ConvertFrom-Json }
function Save-Db($db) { $db | ConvertTo-Json -Depth 20 | Set-Content -Path $dbPath -Encoding UTF8 }
function New-Id([string]$p) { "$p-$([guid]::NewGuid().ToString('N'))" }

function Hash-Password([string]$value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($value)
  $hashBytes = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
  ([BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
}

function Get-BodyObject([string]$body) {
  if ([string]::IsNullOrWhiteSpace($body)) { return @{} }
  $body | ConvertFrom-Json
}

function Parse-Cookies([string]$cookieHeader) {
  $cookies = @{}
  if ([string]::IsNullOrWhiteSpace($cookieHeader)) { return $cookies }
  foreach ($part in $cookieHeader -split ';') {
    $kv = $part.Trim().Split('=', 2)
    if ($kv.Length -eq 2) { $cookies[$kv[0]] = $kv[1] }
  }
  return $cookies
}

function Public-User($user) {
  @{
    username = $user.username
    displayName = $user.displayName
    bio = $user.bio
    avatar = $user.avatar
    privateAccount = [bool]$user.privateAccount
    followers = @($user.followers)
    following = @($user.following)
    followRequests = @($user.followRequests)
  }
}

function Find-User($db, [string]$username) {
  $db.users | Where-Object { $_.username -eq $username } | Select-Object -First 1
}

function Require-User($request, $db) {
  $token = $request.Cookies["ds_session"]
  if (-not $token) { return $null }
  $username = $db.sessions.$token
  if (-not $username) { return $null }
  Find-User $db $username
}

function Can-SeeUser($viewer, $owner) {
  if ($null -eq $viewer -or $null -eq $owner) { return $false }
  if ($viewer.username -eq $owner.username) { return $true }
  if (-not [bool]$owner.privateAccount) { return $true }
  @($owner.followers) -contains $viewer.username
}

function Add-Notification($db, [string]$to, [string]$actor, [string]$text, [string]$type = "info") {
  $db.notifications = @(
    @{
      id = New-Id "notif"
      to = $to
      actor = $actor
      text = $text
      type = $type
      time = "Simdi"
    }
  ) + @($db.notifications | Select-Object -First 49)
}

function Ensure-Conversation($db, [string]$one, [string]$two) {
  $conversation = $db.conversations | Where-Object {
    @($_.participants).Count -eq 2 -and (@($_.participants) -contains $one) -and (@($_.participants) -contains $two)
  } | Select-Object -First 1
  if ($null -eq $conversation) {
    $conversation = @{
      id = New-Id "conv"
      participants = @($one, $two)
      messages = @()
    }
    $db.conversations += $conversation
  }
  $conversation
}

function Build-Bootstrap($db, $viewer) {
  $stories = foreach ($story in @($db.stories)) {
    $owner = Find-User $db $story.owner
    if ($null -ne $owner -and (Can-SeeUser $viewer $owner)) { $story }
  }
  $posts = foreach ($post in @($db.posts)) {
    $owner = Find-User $db $post.author
    if ($null -ne $owner -and (Can-SeeUser $viewer $owner)) { $post }
  }
  $reels = foreach ($reel in @($db.reels)) {
    $owner = Find-User $db $reel.author
    if ($null -ne $owner -and (Can-SeeUser $viewer $owner)) { $reel }
  }
  @{
    me = Public-User $viewer
    users = @($db.users | ForEach-Object { Public-User $_ })
    stories = @($stories)
    posts = @($posts)
    reels = @($reels)
    taggedPosts = @($db.taggedPosts)
    notifications = @($db.notifications | Where-Object { $_.to -eq $viewer.username })
    conversations = @($db.conversations | Where-Object { @($_.participants) -contains $viewer.username })
  }
}

function Save-Upload($body) {
  if ($body.dataUrl -and $body.dataUrl -match "^data:(?<mime>[^;]+);base64,(?<data>.+)$") {
    $extension = switch ($Matches["mime"]) {
      "image/png" { ".png" }
      "image/jpeg" { ".jpg" }
      "image/webp" { ".webp" }
      "image/gif" { ".gif" }
      "video/mp4" { ".mp4" }
      default { ".bin" }
    }
    $name = "$(New-Id 'upload')$extension"
    $path = Join-Path $uploadDir $name
    [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($Matches["data"]))
    return "/uploads/$name"
  }
  "$($body.url)"
}

function Get-StatusText([int]$code) {
  switch ($code) {
    200 { "OK" }
    400 { "Bad Request" }
    401 { "Unauthorized" }
    404 { "Not Found" }
    409 { "Conflict" }
    500 { "Internal Server Error" }
    default { "OK" }
  }
}

function Send-Response($client, [int]$statusCode, [string]$contentType, [byte[]]$bodyBytes, [hashtable]$headers = @{}) {
  $stream = $client.GetStream()
  $writer = New-Object IO.StreamWriter($stream, [Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"
  $writer.WriteLine("HTTP/1.1 $statusCode $(Get-StatusText $statusCode)")
  $writer.WriteLine("Content-Type: $contentType")
  $writer.WriteLine("Content-Length: $($bodyBytes.Length)")
  $writer.WriteLine("Connection: close")
  foreach ($key in $headers.Keys) {
    $writer.WriteLine(("{0}: {1}" -f $key, $headers[$key]))
  }
  $writer.WriteLine("")
  $writer.Flush()
  $stream.Write($bodyBytes, 0, $bodyBytes.Length)
  $stream.Flush()
  $client.Close()
}

function Send-Json($client, [int]$statusCode, $payload, [hashtable]$headers = @{}) {
  $json = $payload | ConvertTo-Json -Depth 20
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  Send-Response $client $statusCode "application/json; charset=utf-8" $bytes $headers
}

function Send-File($client, [string]$path) {
  if (-not (Test-Path $path)) {
    Send-Json $client 404 @{ error = "not_found" }
    return
  }
  $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
  $type = switch ($ext) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".webp" { "image/webp" }
    ".gif" { "image/gif" }
    ".mp4" { "video/mp4" }
    default { "application/octet-stream" }
  }
  Send-Response $client 200 $type ([IO.File]::ReadAllBytes($path))
}

function Read-Request($client) {
  $stream = $client.GetStream()
  $buffer = New-Object byte[] 8192
  $memory = New-Object IO.MemoryStream
  $headerEnd = -1
  do {
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) { break }
    $memory.Write($buffer, 0, $read)
    $bytes = $memory.ToArray()
    for ($i = 0; $i -le $bytes.Length - 4; $i++) {
      if ($bytes[$i] -eq 13 -and $bytes[$i + 1] -eq 10 -and $bytes[$i + 2] -eq 13 -and $bytes[$i + 3] -eq 10) {
        $headerEnd = $i + 4
        break
      }
    }
  } while ($headerEnd -lt 0)

  if ($headerEnd -lt 0) { return $null }

  $allBytes = $memory.ToArray()
  $headerText = [Text.Encoding]::ASCII.GetString($allBytes, 0, $headerEnd)
  $lines = $headerText -split "`r`n"
  $requestLine = $lines[0].Split(' ')
  $headers = @{}
  foreach ($line in $lines[1..($lines.Length - 1)]) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line.Split(':', 2)
    if ($parts.Length -eq 2) { $headers[$parts[0].Trim()] = $parts[1].Trim() }
  }
  $contentLength = 0
  if ($headers.ContainsKey("Content-Length")) { $contentLength = [int]$headers["Content-Length"] }
  $bodyStart = $headerEnd
  while (($memory.Length - $bodyStart) -lt $contentLength) {
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) { break }
    $memory.Write($buffer, 0, $read)
  }
  $allBytes = $memory.ToArray()
  $body = if ($contentLength -gt 0) { [Text.Encoding]::UTF8.GetString($allBytes, $bodyStart, $contentLength) } else { "" }
  @{
    Method = $requestLine[0]
    Path = $requestLine[1].Split('?')[0]
    Headers = $headers
    Cookies = Parse-Cookies $headers["Cookie"]
    Body = $body
  }
}

Ensure-Storage
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $port)
$listener.Start()
Write-Host "Denizstagram server running at http://0.0.0.0:$port/"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $request = Read-Request $client
    if ($null -eq $request) { $client.Close(); continue }

    if ($request.Path -eq "/") { Send-File $client (Join-Path $root "index.html"); continue }
    if ($request.Path -eq "/app.js") { Send-File $client (Join-Path $root "app.js"); continue }
    if ($request.Path -eq "/styles.css") { Send-File $client (Join-Path $root "styles.css"); continue }
    if ($request.Path.StartsWith("/uploads/")) {
      Send-File $client (Join-Path $root $request.Path.TrimStart('/'))
      continue
    }

    $db = Read-Db
    $body = Get-BodyObject $request.Body

    if ($request.Path -eq "/api/register" -and $request.Method -eq "POST") {
      $username = "$($body.username)".ToLowerInvariant().Trim()
      if ([string]::IsNullOrWhiteSpace($username) -or [string]::IsNullOrWhiteSpace($body.password)) { Send-Json $client 400 @{ error = "invalid_input" }; continue }
      if (Find-User $db $username) { Send-Json $client 409 @{ error = "username_taken" }; continue }
      $db.users += @{
        username = $username
        displayName = if ($body.displayName) { $body.displayName } else { $username }
        passwordHash = Hash-Password $body.password
        bio = ""
        avatar = ""
        privateAccount = $false
        followers = @()
        following = @()
        followRequests = @()
      }
      Save-Db $db
      Send-Json $client 200 @{ ok = $true }
      continue
    }

    if ($request.Path -eq "/api/login" -and $request.Method -eq "POST") {
      $username = "$($body.username)".ToLowerInvariant().Trim()
      $viewer = Find-User $db $username
      if ($null -eq $viewer -or $viewer.passwordHash -ne (Hash-Password $body.password)) { Send-Json $client 401 @{ error = "invalid_credentials" }; continue }
      $token = New-Id "sess"
      $db.sessions | Add-Member -NotePropertyName $token -NotePropertyValue $viewer.username
      Save-Db $db
      Send-Json $client 200 @{ ok = $true } @{ "Set-Cookie" = "ds_session=$token; Path=/; HttpOnly" }
      continue
    }

    if ($request.Path -eq "/api/logout" -and $request.Method -eq "POST") {
      $token = $request.Cookies["ds_session"]
      if ($token -and $db.sessions.$token) { $db.sessions.PSObject.Properties.Remove($token) }
      Save-Db $db
      Send-Json $client 200 @{ ok = $true } @{ "Set-Cookie" = "ds_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT" }
      continue
    }

    $viewer = Require-User $request $db
    if ($request.Path -eq "/api/bootstrap" -and $request.Method -eq "GET") {
      if ($null -eq $viewer) { Send-Json $client 401 @{ error = "auth_required" }; continue }
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($null -eq $viewer) { Send-Json $client 401 @{ error = "auth_required" }; continue }

    if ($request.Path -eq "/api/create" -and $request.Method -eq "POST") {
      $media = Save-Upload $body
      if ([string]::IsNullOrWhiteSpace($media)) { Send-Json $client 400 @{ error = "media_required" }; continue }
      if ($body.type -eq "reel") {
        $db.reels += @{ id = New-Id "reel"; author = $viewer.username; caption = if ($body.caption) { $body.caption } else { $body.title }; media = $media; likedBy = @(); views = 0; comments = @() }
      } elseif ($body.type -eq "story") {
        $db.stories = @($db.stories | Where-Object { -not ($_.owner -eq $viewer.username -and $_.placeholder) })
        $db.stories = @(@{ id = New-Id "story"; owner = $viewer.username; image = $media; caption = if ($body.caption) { $body.caption } else { $body.title } }) + @($db.stories)
      } else {
        $db.posts += @{ id = New-Id "post"; author = $viewer.username; title = $body.title; caption = $body.caption; media = $media; likedBy = @(); savedBy = @(); dateLabel = "Simdi"; comments = @() }
      }
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/follow" -and $request.Method -eq "POST") {
      $target = Find-User $db $body.username
      if ($null -eq $target -or $target.username -eq $viewer.username) { Send-Json $client 404 @{ error = "not_found" }; continue }
      if (@($target.followers) -contains $viewer.username) {
        $target.followers = @($target.followers | Where-Object { $_ -ne $viewer.username })
        $viewer.following = @($viewer.following | Where-Object { $_ -ne $target.username })
      } elseif ((@($target.followRequests) -contains $viewer.username)) {
      } elseif ([bool]$target.privateAccount) {
        $target.followRequests += $viewer.username
        Add-Notification $db $target.username $viewer.username "sana takip istegi gonderdi." "follow_request"
      } else {
        $target.followers += $viewer.username
        $viewer.following += $target.username
        Add-Notification $db $target.username $viewer.username "seni takip etmeye basladi."
      }
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/follow/accept" -and $request.Method -eq "POST") {
      $requester = Find-User $db $body.username
      if ($null -eq $requester) { Send-Json $client 404 @{ error = "not_found" }; continue }
      $viewer.followRequests = @($viewer.followRequests | Where-Object { $_ -ne $requester.username })
      if (-not (@($viewer.followers) -contains $requester.username)) { $viewer.followers += $requester.username }
      if (-not (@($requester.following) -contains $viewer.username)) { $requester.following += $viewer.username }
      $db.notifications = @($db.notifications | Where-Object { -not (($_.to -eq $viewer.username) -and ($_.actor -eq $requester.username) -and ($_.type -eq "follow_request")) })
      Add-Notification $db $requester.username $viewer.username "takip istegini kabul etti."
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/post/like" -and $request.Method -eq "POST") {
      $post = $db.posts | Where-Object { $_.id -eq $body.id } | Select-Object -First 1
      if ($null -eq $post) { Send-Json $client 404 @{ error = "not_found" }; continue }
      if (@($post.likedBy) -contains $viewer.username) {
        $post.likedBy = @($post.likedBy | Where-Object { $_ -ne $viewer.username })
      } else {
        $post.likedBy += $viewer.username
        if ($post.author -ne $viewer.username) { Add-Notification $db $post.author $viewer.username "gonderini begendi." }
      }
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/post/save" -and $request.Method -eq "POST") {
      $post = $db.posts | Where-Object { $_.id -eq $body.id } | Select-Object -First 1
      if ($null -eq $post) { Send-Json $client 404 @{ error = "not_found" }; continue }
      if (@($post.savedBy) -contains $viewer.username) {
        $post.savedBy = @($post.savedBy | Where-Object { $_ -ne $viewer.username })
      } else {
        $post.savedBy += $viewer.username
      }
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/post/comment" -and $request.Method -eq "POST") {
      $post = $db.posts | Where-Object { $_.id -eq $body.id } | Select-Object -First 1
      if ($null -eq $post) { Send-Json $client 404 @{ error = "not_found" }; continue }
      $post.comments += @{ id = New-Id "comment"; author = $viewer.username; text = $body.text }
      if ($post.author -ne $viewer.username) { Add-Notification $db $post.author $viewer.username "gonderine yorum yapti." }
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/reel/like" -and $request.Method -eq "POST") {
      $reel = $db.reels | Where-Object { $_.id -eq $body.id } | Select-Object -First 1
      if ($null -eq $reel) { Send-Json $client 404 @{ error = "not_found" }; continue }
      if (@($reel.likedBy) -contains $viewer.username) {
        $reel.likedBy = @($reel.likedBy | Where-Object { $_ -ne $viewer.username })
      } else {
        $reel.likedBy += $viewer.username
        if ($reel.author -ne $viewer.username) { Add-Notification $db $reel.author $viewer.username "reelini begendi." }
      }
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/reel/comment" -and $request.Method -eq "POST") {
      $reel = $db.reels | Where-Object { $_.id -eq $body.id } | Select-Object -First 1
      if ($null -eq $reel) { Send-Json $client 404 @{ error = "not_found" }; continue }
      if (-not $reel.comments) { $reel | Add-Member -NotePropertyName comments -NotePropertyValue @() }
      $reel.comments += @{ id = New-Id "comment"; author = $viewer.username; text = $body.text }
      if ($reel.author -ne $viewer.username) { Add-Notification $db $reel.author $viewer.username "reeline yorum yapti." }
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/messages" -and $request.Method -eq "POST") {
      $conversation = Ensure-Conversation $db $viewer.username $body.username
      if ($body.text) {
        $conversation.messages += @{ id = New-Id "message"; sender = $viewer.username; text = $body.text; time = "Simdi" }
        Add-Notification $db $body.username $viewer.username "sana mesaj gonderdi."
      }
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    if ($request.Path -eq "/api/profile" -and $request.Method -eq "POST") {
      $viewer.displayName = $body.displayName
      $viewer.bio = $body.bio
      $viewer.avatar = $body.avatar
      $viewer.privateAccount = [bool]$body.privateAccount
      Save-Db $db
      Send-Json $client 200 (Build-Bootstrap $db $viewer)
      continue
    }

    Send-Json $client 404 @{ error = "not_found" }
  } catch {
    Send-Json $client 500 @{ error = "server_error"; detail = $_.Exception.Message }
  }
}
