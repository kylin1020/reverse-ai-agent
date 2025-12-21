// Original script - will be replaced via MCP tool
function getMessage() {
    return "ORIGINAL MESSAGE - NOT REPLACED";
}

function init() {
    const result = document.getElementById('result');
    result.textContent = getMessage();
    result.style.color = 'red';
    
    document.getElementById('btn').addEventListener('click', function() {
        alert('Button clicked! Message: ' + getMessage());
    });
}

document.addEventListener('DOMContentLoaded', init);
console.log('app.js loaded - version: ORIGINAL');
