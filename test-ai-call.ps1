# Test AI-Powered Natural Language Calling
# PowerShell script to test the AI calling feature

param(
    [Parameter(Mandatory=$true)]
    [string]$Instruction,

    [string]$UserName = "Test User",
    [string]$UserId = "test-123",
    [string]$ServerUrl = "http://localhost:3000"
)

Write-Host ""
Write-Host "🤖 AIME AI Calling - Test Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Instruction: " -ForegroundColor Yellow -NoNewline
Write-Host $Instruction
Write-Host ""

# Prepare request body
$body = @{
    instruction = $Instruction
    userId = $UserId
    userName = $UserName
} | ConvertTo-Json

Write-Host "Sending request to AIME server..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/calls/ai-initiate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    Write-Host ""
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ""

    Write-Host "Message: " -ForegroundColor Cyan -NoNewline
    Write-Host $response.message
    Write-Host ""

    if ($response.details) {
        Write-Host "Details:" -ForegroundColor Cyan
        Write-Host "  Contact: $($response.details.contactName)"
        Write-Host "  Phone: $($response.details.phoneNumber)"
        Write-Host "  Instructions: $($response.details.instructions)"
        Write-Host "  Room: $($response.details.roomName)"
        Write-Host "  Call ID: $($response.details.callId)"
        Write-Host ""
        Write-Host "  Monitor URL: $($response.details.monitorUrl)"
    }

    Write-Host ""
    if ($response.notification) {
        Write-Host "📱 Notification: $($response.notification)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "✅ Call initiated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Check the voice agent terminal to see real-time activity." -ForegroundColor Gray

} catch {
    Write-Host ""
    Write-Host "❌ Error initiating AI call" -ForegroundColor Red
    Write-Host ""

    if ($_.ErrorDetails.Message) {
        $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Error: $($errorObj.error)" -ForegroundColor Red
        Write-Host "Message: $($errorObj.message)" -ForegroundColor Yellow
    } else {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure AIME server is running (npx pnpm run dev)"
    Write-Host "2. Verify voice agent is running (python agents/voice_agent.py start)"
    Write-Host "3. Check that ngrok is running and OPENCLAW_BASE_URL is set"
    Write-Host "4. Ensure LIVEKIT_SIP_TRUNK_ID is configured in .env"
}

Write-Host ""

<#
.SYNOPSIS
Test the AI-powered natural language calling feature

.DESCRIPTION
This script sends a natural language instruction to the AIME server to initiate an outbound call.

.PARAMETER Instruction
The natural language instruction for the AI agent.
Example: "Call John at 555-1234 and ask if he's free for lunch tomorrow"

.PARAMETER UserName
Your name (optional, defaults to "Test User")

.PARAMETER UserId
Your user ID (optional, defaults to "test-123")

.PARAMETER ServerUrl
AIME server URL (optional, defaults to "http://localhost:3000")

.EXAMPLE
.\test-ai-call.ps1 -Instruction "Call 555-1234 and say this is a test call"

.EXAMPLE
.\test-ai-call.ps1 -Instruction "Call JC Lopez at 786-731-8794 and ask if he's available for lunch today" -UserName "Joe Machado"

.EXAMPLE
.\test-ai-call.ps1 -Instruction "Call Sarah at +14155551234 and confirm she's coming to the meeting tomorrow at 2 PM. Notify me via text at 305-555-1234."
#>
