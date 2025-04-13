// Initialize chart instances
let cpuChart, memoryChart, networkChart;

// Initialize charts once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const cpuCtx = document.getElementById('cpuChart').getContext('2d');
    const memoryCtx = document.getElementById('memoryChart').getContext('2d');
    const networkCtx = document.getElementById('networkChart').getContext('2d');
    
    // Common chart configuration
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500
            },
            elements: {
                line: {
                    tension: 0.3
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(100, 100, 100, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(200, 200, 200, 0.8)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(100, 100, 100, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(200, 200, 200, 0.8)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(40, 40, 40, 0.9)',
                    borderColor: 'rgba(60, 60, 60, 1)',
                    borderWidth: 1
                }
            }
        }
    };
    
    // CPU Chart
    cpuChart = new Chart(cpuCtx, {
        ...chartConfig,
        data: {
            labels: sessionData.metrics.cpu.labels,
            datasets: [{
                label: 'CPU Usage (%)',
                data: sessionData.metrics.cpu.values,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderWidth: 2,
                fill: true
            }]
        }
    });
    
    // Memory Chart
    memoryChart = new Chart(memoryCtx, {
        ...chartConfig,
        data: {
            labels: sessionData.metrics.memory.labels,
            datasets: [{
                label: 'Memory Usage (%)',
                data: sessionData.metrics.memory.values,
                borderColor: 'rgba(153, 102, 255, 1)',
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderWidth: 2,
                fill: true
            }]
        }
    });
    
    // Network Chart - this one creates a mock dataset if not available
    const networkData = sessionData.metrics.network || {
        values: [0, 0, 0, 0, 0, 0],
        labels: ['1m', '2m', '3m', '4m', '5m', '6m']
    };
    
    networkChart = new Chart(networkCtx, {
        ...chartConfig,
        data: {
            labels: networkData.labels,
            datasets: [{
                label: 'Network I/O (KB/s)',
                data: networkData.values,
                borderColor: 'rgba(255, 159, 64, 1)',
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                borderWidth: 2,
                fill: true
            }]
        }
    });
});

// Request initial update when page loads
window.addEventListener('load', () => {
    vscode.postMessage({
        command: 'requestUpdate',
        sessionId: sessionData.id
    });
    
    // Set up regular telemetry update requests every 5 seconds
    setInterval(() => {
        vscode.postMessage({
            command: 'requestUpdate',
            sessionId: sessionData.id
        });
    }, 5000);
});

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    
    if (message.command === 'telemetryUpdate') {
        // Update the CPU chart
        cpuChart.data.labels = message.metrics.cpu.labels;
        cpuChart.data.datasets[0].data = message.metrics.cpu.values;
        cpuChart.update();
        
        // Update the memory chart
        memoryChart.data.labels = message.metrics.memory.labels;
        memoryChart.data.datasets[0].data = message.metrics.memory.values;
        memoryChart.update();
        
        // Update the network chart
        networkChart.data.labels = message.metrics.network.labels;
        networkChart.data.datasets[0].data = message.metrics.network.values;
        networkChart.update();
    }
});