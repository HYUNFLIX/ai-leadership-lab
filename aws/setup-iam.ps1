# IAM 관리자 사용자 생성 + CLI 키 전환 (1회 실행용)
# 실행: powershell -ExecutionPolicy Bypass -File aws\setup-iam.ps1
# 비밀키는 화면에 출력하지 않고 CLI 설정에만 저장합니다.

Write-Host "1/4 IAM 사용자 생성 (ailab-admin)..."
aws iam create-user --user-name ailab-admin | Out-Null

Write-Host "2/4 관리자 권한 부여..."
aws iam attach-user-policy --user-name ailab-admin --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

Write-Host "3/4 액세스 키 발급 및 CLI 전환..."
$key = aws iam create-access-key --user-name ailab-admin | ConvertFrom-Json
aws configure set aws_access_key_id $key.AccessKey.AccessKeyId
aws configure set aws_secret_access_key $key.AccessKey.SecretAccessKey
aws configure set region ap-northeast-2
aws configure set output json

Write-Host "4/4 전환 확인..."
aws sts get-caller-identity

Write-Host ""
Write-Host "완료! 위 Arn이 'user/ailab-admin'이면 성공입니다."
Write-Host "이후 AWS 콘솔 > 내 보안 자격 증명에서 루트 액세스 키를 비활성화하세요."
