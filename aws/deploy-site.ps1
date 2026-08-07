# 정적 사이트 배포: git 추적 파일만 S3 동기화 + CloudFront 무효화
# 실행: powershell -ExecutionPolicy Bypass -File aws\deploy-site.ps1
$ErrorActionPreference = "Stop"
$BUCKET = "ailab-site-prod"
$REPO = Split-Path $PSScriptRoot -Parent

# CloudFront 배포 ID 조회
$DIST_ID = aws cloudformation describe-stacks --stack-name ailab-site --region us-east-1 `
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text

Write-Host "1/3 git 추적 파일을 임시 폴더로 추출..."
$TMP = Join-Path $env:TEMP "ailab-site-deploy"
if (Test-Path $TMP) { Remove-Item -Recurse -Force $TMP }
New-Item -ItemType Directory -Force $TMP | Out-Null
Push-Location $REPO
git archive HEAD | tar -x -C $TMP
Pop-Location
# 웹에 불필요한 항목 제외
Remove-Item -Recurse -Force (Join-Path $TMP "aws") -ErrorAction SilentlyContinue

Write-Host "2/3 S3 동기화 (s3://$BUCKET)..."
aws s3 sync $TMP "s3://$BUCKET" --delete --region us-east-1

Write-Host "3/3 CloudFront 캐시 무효화..."
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" --query "Invalidation.Id" --output text

Remove-Item -Recurse -Force $TMP
Write-Host "배포 완료!" -ForegroundColor Green
