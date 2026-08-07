# Claude API 키 → AWS SSM 등록 (1회 실행용)
# 실행: powershell -ExecutionPolicy Bypass -File aws\register-api-key.ps1
# 키는 이 창에서 입력받아 SSM에 암호화 저장되며, 화면·기록에 남지 않습니다.

$secure = Read-Host "Claude API 키를 붙여넣고 Enter (입력이 화면에 보이지 않습니다)" -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

if (-not $key -or -not $key.StartsWith("sk-ant-")) {
    Write-Host "sk-ant- 로 시작하는 키가 아닙니다. 다시 실행해 주세요." -ForegroundColor Red
    exit 1
}

aws ssm put-parameter --name /ailab/anthropic-api-key --type SecureString --value $key --overwrite | Out-Null
$key = $null

Write-Host ""
Write-Host "등록 완료! SSM /ailab/anthropic-api-key 에 암호화 저장되었습니다." -ForegroundColor Green
