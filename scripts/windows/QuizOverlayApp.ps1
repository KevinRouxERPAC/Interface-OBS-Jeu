# Quiz Overlay - Application de gestion
# Interface graphique pour lancer et arrêter le serveur

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Configuration
$script:projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$script:pidFile = Join-Path $script:projectRoot "api\.server.pid"
$script:apiUrl = "http://localhost:3000"
$script:statusCheckTimer = $null
$script:serverProcess = $null

# Créer le formulaire principal
$form = New-Object System.Windows.Forms.Form
$form.Text = "Quiz Overlay - Gestion du Serveur"
$form.Size = New-Object System.Drawing.Size(500, 400)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(45, 45, 48)

# Logo/Titre
$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "Quiz Overlay pour OBS"
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(66, 232, 196)
$lblTitle.AutoSize = $true
$lblTitle.Location = New-Object System.Drawing.Point(20, 20)
$form.Controls.Add($lblTitle)

# Statut
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "Vérification du statut..."
$lblStatus.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$lblStatus.ForeColor = [System.Drawing.Color]::White
$lblStatus.AutoSize = $true
$lblStatus.Location = New-Object System.Drawing.Point(20, 60)
$form.Controls.Add($lblStatus)

# Informations détaillées
$txtInfo = New-Object System.Windows.Forms.TextBox
$txtInfo.Multiline = $true
$txtInfo.ReadOnly = $true
$txtInfo.ScrollBars = "Vertical"
$txtInfo.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 30)
$txtInfo.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 200)
$txtInfo.Font = New-Object System.Drawing.Font("Consolas", 9)
$txtInfo.BorderStyle = "FixedSingle"
$txtInfo.Location = New-Object System.Drawing.Point(20, 90)
$txtInfo.Size = New-Object System.Drawing.Size(450, 180)
$form.Controls.Add($txtInfo)

# Bouton Démarrer
$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "[>] Démarrer le serveur"
$btnStart.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnStart.BackColor = [System.Drawing.Color]::FromArgb(76, 175, 80)
$btnStart.ForeColor = [System.Drawing.Color]::White
$btnStart.FlatStyle = "Flat"
$btnStart.FlatAppearance.BorderSize = 0
$btnStart.Size = New-Object System.Drawing.Size(200, 45)
$btnStart.Location = New-Object System.Drawing.Point(20, 290)
$btnStart.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnStart)

# Bouton Arrêter
$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = "[Stop] Arrêter le serveur"
$btnStop.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnStop.BackColor = [System.Drawing.Color]::FromArgb(244, 67, 54)
$btnStop.ForeColor = [System.Drawing.Color]::White
$btnStop.FlatStyle = "Flat"
$btnStop.FlatAppearance.BorderSize = 0
$btnStop.Size = New-Object System.Drawing.Size(200, 45)
$btnStop.Location = New-Object System.Drawing.Point(240, 290)
$btnStop.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnStop)

# Bouton Ouvrir Admin
$btnAdmin = New-Object System.Windows.Forms.Button
$btnAdmin.Text = "[Web] Ouvrir Admin"
$btnAdmin.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnAdmin.BackColor = [System.Drawing.Color]::FromArgb(33, 150, 243)
$btnAdmin.ForeColor = [System.Drawing.Color]::White
$btnAdmin.FlatStyle = "Flat"
$btnAdmin.FlatAppearance.BorderSize = 0
$btnAdmin.Size = New-Object System.Drawing.Size(140, 35)
$btnAdmin.Location = New-Object System.Drawing.Point(20, 345)
$btnAdmin.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnAdmin)

# Bouton Ouvrir Overlay
$btnOverlay = New-Object System.Windows.Forms.Button
$btnOverlay.Text = "[TV] Ouvrir Overlay"
$btnOverlay.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnOverlay.BackColor = [System.Drawing.Color]::FromArgb(156, 39, 176)
$btnOverlay.ForeColor = [System.Drawing.Color]::White
$btnOverlay.FlatStyle = "Flat"
$btnOverlay.FlatAppearance.BorderSize = 0
$btnOverlay.Size = New-Object System.Drawing.Size(140, 35)
$btnOverlay.Location = New-Object System.Drawing.Point(170, 345)
$btnOverlay.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnOverlay)

# Bouton Actualiser
$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = "[Refresh] Actualiser"
$btnRefresh.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnRefresh.BackColor = [System.Drawing.Color]::FromArgb(96, 125, 139)
$btnRefresh.ForeColor = [System.Drawing.Color]::White
$btnRefresh.FlatStyle = "Flat"
$btnRefresh.FlatAppearance.BorderSize = 0
$btnRefresh.Size = New-Object System.Drawing.Size(140, 35)
$btnRefresh.Location = New-Object System.Drawing.Point(320, 345)
$btnRefresh.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnRefresh)

# Fonction pour vérifier le statut
function Update-Status {
    $statusText = ""
    $isRunning = $false
    
    if (Test-Path $script:pidFile) {
        $serverPid = (Get-Content $script:pidFile -Raw).Trim()
        
        try {
            $process = Get-Process -Id $serverPid -ErrorAction Stop
            
            if ($process.ProcessName -eq "node") {
                $isRunning = $true
                $statusText = "[OK] Serveur en cours d'execution`n"
                $statusText += "PID: $serverPid`n"
                $statusText += "Demarrage: $($process.StartTime)`n"
                $statusText += "Memoire: $([math]::Round($process.WorkingSet64 / 1MB, 2)) MB`n`n"
                
                # Tester si le serveur répond
                try {
                    $response = Invoke-WebRequest -Uri "$script:apiUrl/health" -TimeoutSec 2 -ErrorAction Stop
                    $statusText += "Health: [OK] OK`n"
                    $statusText += "URL: $script:apiUrl`n"
                } catch {
                    $statusText += "Health: [Attention] Ne repond pas`n"
                }
                
                $script:serverProcess = $process
            } else {
                $statusText = "[Attention] Le PID ne correspond pas a un processus Node.js`n"
                Remove-Item $script:pidFile -ErrorAction SilentlyContinue
            }
        } catch {
            $statusText = "[Erreur] Serveur arrete (fichier PID obsolete)`n"
            Remove-Item $script:pidFile -ErrorAction SilentlyContinue
        }
    } else {
        $statusText = "[Erreur] Serveur arrete`n`n"
        
        # Vérifier s'il y a des processus Node.js qui pourraient être le serveur
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
            $_.Path -like "*Interface OBS Jeu*"
        }
        
        if ($nodeProcesses) {
            $statusText += "[Attention] Processus Node.js detectes (sans fichier PID):`n"
            $nodeProcesses | ForEach-Object {
                $statusText += "  PID: $($_.Id) | Path: $($_.Path)`n"
            }
        }
    }
    
    $txtInfo.Text = $statusText
    $lblStatus.Text = if ($isRunning) { "[Actif] Serveur actif" } else { "[Arrete] Serveur arrete" }
    $lblStatus.ForeColor = if ($isRunning) { [System.Drawing.Color]::FromArgb(76, 175, 80) } else { [System.Drawing.Color]::FromArgb(244, 67, 54) }
    
    $btnStart.Enabled = -not $isRunning
    $btnStop.Enabled = $isRunning
    $btnAdmin.Enabled = $isRunning
    $btnOverlay.Enabled = $isRunning
}

# Fonction pour démarrer le serveur
function Start-Server {
    $apiDir = Join-Path $script:projectRoot "api"
    
    # Vérifier si le serveur est déjà en cours d'exécution
    if (Test-Path $script:pidFile) {
        $oldPid = (Get-Content $script:pidFile -Raw).Trim()
        try {
            $oldProcess = Get-Process -Id $oldPid -ErrorAction Stop
            if ($oldProcess.ProcessName -eq "node") {
                [System.Windows.Forms.MessageBox]::Show(
                    "Un serveur est déjà en cours d'exécution (PID: $oldPid).`nVeuillez l'arrêter d'abord.",
                    "Serveur déjà actif",
                    [System.Windows.Forms.MessageBoxButtons]::OK,
                    [System.Windows.Forms.MessageBoxIcon]::Warning
                )
                return
            }
        } catch {
            Remove-Item $script:pidFile -ErrorAction SilentlyContinue
        }
    }
    
    # Vérifier le fichier .env
    $envFile = Join-Path $apiDir ".env"
    if (-not (Test-Path $envFile)) {
        $envExample = Join-Path $script:projectRoot ".env.example"
        if (Test-Path $envExample) {
            Copy-Item $envExample $envFile
            [System.Windows.Forms.MessageBox]::Show(
                "Le fichier .env a été créé depuis .env.example.`nVeuillez le configurer avant de relancer.",
                "Configuration requise",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
            return
        } else {
            [System.Windows.Forms.MessageBox]::Show(
                "Le fichier .env.example est introuvable à la racine du projet.",
                "Erreur de configuration",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            )
            return
        }
    }
    
    # Installer les dépendances si nécessaire
    if (-not (Test-Path (Join-Path $apiDir "node_modules"))) {
        $txtInfo.Text = "Installation des dépendances en cours...`nCela peut prendre quelques instants."
        $form.Refresh()
        
        Push-Location $apiDir
        $installOutput = npm install 2>&1
        Pop-Location
        
        if ($LASTEXITCODE -ne 0) {
            [System.Windows.Forms.MessageBox]::Show(
                "Erreur lors de l'installation des dépendances.`nVérifiez la console pour plus de détails.",
                "Erreur d'installation",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            )
            return
        }
    }
    
    # Vérifier si Node.js est installé
    try {
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Node.js non trouvé"
        }
    } catch {
        [System.Windows.Forms.MessageBox]::Show(
            "Node.js n'est pas installé ou n'est pas dans le PATH.`nVeuillez installer Node.js pour continuer.",
            "Node.js requis",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return
    }
    
    # Démarrer le serveur directement avec Node.js en arrière-plan
    Push-Location $apiDir
    $env:NODE_ENV = "production"
    
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "node"
    $processInfo.Arguments = "server.js"
    $processInfo.WorkingDirectory = $apiDir
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.RedirectStandardOutput = $false
    $processInfo.RedirectStandardError = $false
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    $process.Start() | Out-Null
    
    # Sauvegarder le PID immédiatement
    $process.Id | Out-File -FilePath $script:pidFile -Encoding ASCII
    
    Pop-Location
    
    # Attendre un peu pour que le serveur démarre
    Start-Sleep -Seconds 2
    
    # Vérifier que le serveur répond
    $maxHealthCheck = 5
    $healthChecked = 0
    $serverResponding = $false
    while (-not $serverResponding -and $healthChecked -lt $maxHealthCheck) {
        try {
            $response = Invoke-WebRequest -Uri "$script:apiUrl/health" -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $serverResponding = $true
            }
        } catch {
            Start-Sleep -Seconds 1
            $healthChecked++
        }
    }
    
    if (-not $serverResponding) {
        [System.Windows.Forms.MessageBox]::Show(
            "Le serveur a demarre mais ne repond pas encore.`nAttendez quelques secondes et actualisez le statut.",
            "Demarrage en cours",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    }
    
    Pop-Location
    
    # Vérifier le statut
    Update-Status
    
    if (Test-Path $script:pidFile) {
        [System.Windows.Forms.MessageBox]::Show(
            "[OK] Serveur demarre avec succes!`n`nAdmin: $script:apiUrl/admin`nOverlay: $script:apiUrl/overlay",
            "Serveur demarre",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    } else {
        [System.Windows.Forms.MessageBox]::Show(
            "[Attention] Le serveur semble avoir des difficultes a demarrer.`nVerifiez les logs pour plus d'informations.",
            "Probleme de demarrage",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
    }
}

# Fonction pour arrêter le serveur
function Stop-Server {
    if (-not (Test-Path $script:pidFile)) {
        [System.Windows.Forms.MessageBox]::Show(
            "Aucun serveur en cours d'exécution.",
            "Information",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
        return
    }
    
    $serverPid = (Get-Content $script:pidFile -Raw).Trim()
    
    try {
        $process = Get-Process -Id $serverPid -ErrorAction Stop
        
        if ($process.ProcessName -eq "node") {
            Stop-Process -Id $serverPid -Force
            Remove-Item $script:pidFile -ErrorAction SilentlyContinue
            [System.Windows.Forms.MessageBox]::Show(
                "[OK] Serveur arrete avec succes.",
                "Serveur arrete",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
        } else {
            [System.Windows.Forms.MessageBox]::Show(
                "[Attention] Le PID ne correspond pas a un processus Node.js.",
                "Erreur",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            )
        }
    } catch {
        [System.Windows.Forms.MessageBox]::Show(
            "[Attention] Processus deja arrete ou introuvable.",
            "Information",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
        Remove-Item $script:pidFile -ErrorAction SilentlyContinue
    }
    
    Update-Status
}

# Fonction pour ouvrir l'admin
function Open-Admin {
    Start-Process "$script:apiUrl/admin"
}

# Fonction pour ouvrir l'overlay
function Open-Overlay {
    Start-Process "$script:apiUrl/overlay"
}

# Événements des boutons
$btnStart.Add_Click({ Start-Server })
$btnStop.Add_Click({ Stop-Server })
$btnAdmin.Add_Click({ Open-Admin })
$btnOverlay.Add_Click({ Open-Overlay })
$btnRefresh.Add_Click({ Update-Status })

# Timer pour actualiser le statut automatiquement
$script:statusCheckTimer = New-Object System.Windows.Forms.Timer
$script:statusCheckTimer.Interval = 5000 # 5 secondes
$script:statusCheckTimer.Add_Tick({ Update-Status })
$script:statusCheckTimer.Start()

# Actualiser le statut au démarrage
Update-Status

# Gestion de la fermeture
$form.Add_FormClosing({
    if ($script:statusCheckTimer) {
        $script:statusCheckTimer.Stop()
        $script:statusCheckTimer.Dispose()
    }
})

# Afficher le formulaire
[System.Windows.Forms.Application]::EnableVisualStyles()
$form.ShowDialog() | Out-Null
