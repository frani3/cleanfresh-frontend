<#
.SYNOPSIS
  Baja y sube el microservicio de notificaciones en la EC2 de microservicios, desde tu PC, para demostrar como RabbitMQ
  conserva los mensajes mientras el servicio esta caido (Spec 038).

.DESCRIPTION
  Hace por SSH lo que de otro modo habria que escribir a mano en la EC2:
    bajar  -> docker compose stop notificaciones   (RabbitMQ queda sin consumidores; los mensajes nuevos esperan en las colas)
    subir  -> docker compose start notificaciones  (espera a que responda; los mensajes pendientes se entregan)
    estado -> muestra si el contenedor esta arriba y si su API responde

.EXAMPLE
  .\servicio-notificaciones.ps1 bajar -Ip 18.215.249.240
  # ... haz el pedido como Cliente y mira la consola de RabbitMQ: la cola queda con Ready = 1 ...
  .\servicio-notificaciones.ps1 subir -Ip 18.215.249.240

.PARAMETER Accion
  bajar | subir | estado

.PARAMETER Ip
  IP publica de la EC2 cleanfresh-ms (cambia cada vez que se apaga el laboratorio; se ve en la consola de EC2).

.PARAMETER Llave
  Ruta de la llave .pem (por defecto, la de Descargas).

.PARAMETER Mostrar
  Solo muestra el comando que se ejecutaria, sin conectarse.
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("bajar", "subir", "estado")]
  [string]$Accion,

  [Parameter(Mandatory = $true)]
  [string]$Ip,

  [string]$Llave = "C:\Users\franc\Downloads\key.pem",

  [switch]$Mostrar
)

$ErrorActionPreference = "Stop"
$carpeta = "~/cleanfresh/cleanfresh-frontend/EP2/despliegue"

# OJO: los comandos remotos no llevan comillas dobles. Windows PowerShell 5.1 no las escapa al pasar el argumento a ssh y
# el comando llegaria roto; por eso solo se usan comillas simples y sustituciones $(...) sin comillas.
$consulta = "curl -s -m 5 -o /dev/null -w %{http_code} localhost:8083/api/notificaciones"
switch ($Accion) {
  "bajar" {
    $remoto = "cd $carpeta && sudo docker compose stop notificaciones && echo '--- notificaciones DETENIDO: los mensajes nuevos esperan en RabbitMQ' && sudo docker compose ps -a --format '{{.Service}}:{{.Status}}' | grep notificaciones"
  }
  "subir" {
    $remoto = "cd $carpeta && sudo docker compose start notificaciones && echo 'esperando a que arranque (hasta 2 minutos)...' && for i in `$(seq 1 45); do [ `$($consulta) = 200 ] && break; sleep 3; done; echo '--- API de avisos, HTTP (200 = arriba y entregando los mensajes pendientes):' `$($consulta)"
  }
  "estado" {
    $remoto = "cd $carpeta && sudo docker compose ps -a --format '{{.Service}}:{{.Status}}' | grep notificaciones; echo '--- API de avisos, HTTP (200 = arriba, 000 = caido):' `$($consulta)"
  }
}

$comando = @("-i", $Llave, "-o", "ConnectTimeout=15", "-o", "StrictHostKeyChecking=accept-new", "ec2-user@$Ip", $remoto)

if ($Mostrar) {
  Write-Host ("ssh " + ($comando -join " "))
  return
}
if (-not (Test-Path $Llave)) {
  Write-Error "No encuentro la llave en $Llave. Indica la ruta con -Llave."
}

& ssh @comando
if ($LASTEXITCODE -ne 0) {
  Write-Error "ssh termino con error ($LASTEXITCODE). Revisa la IP ($Ip): cambia cada vez que se apaga el laboratorio, y tu IP debe estar en el grupo de seguridad de la EC2."
}
