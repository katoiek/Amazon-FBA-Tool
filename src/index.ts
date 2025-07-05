import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseCSVText, analyzeTransactions } from './utils/csvParser';
import { DashboardData } from './types';

const app = new Hono();

// CORS設定
app.use('/api/*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 静的ファイルの配信はCloudflare Workers環境でのみ有効
// app.use('/*', serveStatic({ root: './public' }));

// メインページ
app.get('/', (c) => {
  console.log('🏠 Main page accessed');
  return c.html(getIndexHTML());
});

// CSVアップロード・解析API
app.post('/api/analyze', async (c) => {
  try {
    console.log('📤 CSV analysis request received');
    const body = await c.req.parseBody();
    const csvFile = body.csvFile as File;

    if (!csvFile) {
      console.log('❌ No CSV file provided');
      return c.json({ error: 'CSVファイルが選択されていません' }, 400);
    }

    console.log('📁 Processing CSV file:', csvFile.name);
    const csvText = await csvFile.text();
    const transactions = parseCSVText(csvText);
    console.log(`📊 Parsed ${transactions.length} transactions`);

    const dashboardData = analyzeTransactions(transactions);
    console.log('✅ Analysis completed successfully');

    return c.json(dashboardData);
  } catch (error) {
    console.error('CSV解析エラー:', error);
    return c.json({ error: 'CSV解析中にエラーが発生しました' }, 500);
  }
});



function getIndexHTML(): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Amazon FBA 売上分析ダッシュボード</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f5f5f5;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            text-align: center;
        }

        .upload-section {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }

        .file-input-container {
            border: 2px dashed #ddd;
            padding: 2rem;
            text-align: center;
            border-radius: 10px;
            margin-bottom: 1rem;
        }

        .file-input-container.dragover {
            border-color: #667eea;
            background-color: #f0f4ff;
        }

        .file-input {
            display: none;
        }

        .file-input-label {
            display: inline-block;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border-radius: 5px;
            cursor: pointer;
            transition: background 0.3s;
        }

        .file-input-label:hover {
            background: #5a6fd8;
        }



        .dashboard {
            display: none;
        }

        .dashboard.active {
            display: block;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }

        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            color: #666;
            margin-top: 0.5rem;
        }

        .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .chart-container {
            background: white;
            padding: 1.5rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .chart-title {
            font-size: 1.2rem;
            margin-bottom: 1rem;
            color: #333;
        }

        .sku-table-container {
            background: white;
            padding: 1.5rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .sku-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }

        .sku-table th,
        .sku-table td {
            text-align: left;
            padding: 0.75rem;
            border-bottom: 1px solid #eee;
        }

        .sku-table th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #333;
        }

        .sku-table tr:hover {
            background-color: #f8f9fa;
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: #666;
        }

        .error {
            background: #dc3545;
            color: white;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
        }

        @media (max-width: 768px) {
            .charts-grid {
                grid-template-columns: 1fr;
            }

            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Amazon FBA 売上分析ダッシュボード</h1>
            <p>CSVファイルをアップロードして売上データを分析</p>
        </div>

        <div class="upload-section">
            <h2>CSVファイルをアップロード</h2>
            <div class="file-input-container" id="fileInputContainer">
                <input type="file" id="csvFile" class="file-input" accept=".csv" />
                <label for="csvFile" class="file-input-label">ファイルを選択</label>
                <p>または、ファイルをここにドラッグ&ドロップしてください</p>
            </div>
            <button onclick="analyzeCSV()" style="display: none;" id="analyzeButton">分析開始</button>
        </div>

        <div id="loading" class="loading" style="display: none;">
            <p>データを分析中...</p>
        </div>

        <div id="error" class="error" style="display: none;"></div>

        <div id="dashboard" class="dashboard">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="totalSales">¥0</div>
                    <div class="stat-label">総売上</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="totalProfit">¥0</div>
                    <div class="stat-label">総利益</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="totalOrders">0</div>
                    <div class="stat-label">注文件数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="totalFees">¥0</div>
                    <div class="stat-label">総手数料</div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-container">
                    <h3 class="chart-title">月別売上推移</h3>
                    <canvas id="monthlyChart"></canvas>
                </div>
                <div class="chart-container">
                    <h3 class="chart-title">費用内訳</h3>
                    <canvas id="feeChart"></canvas>
                </div>
            </div>

            <div class="sku-table-container">
                <h3 class="chart-title">SKU別売上分析</h3>
                <table class="sku-table">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>商品名</th>
                            <th>売上</th>
                            <th>利益</th>
                            <th>数量</th>
                            <th>平均単価</th>
                            <th>利益率</th>
                        </tr>
                    </thead>
                    <tbody id="skuTableBody">
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        let currentData = null;
        let monthlyChart = null;
        let feeChart = null;

        // ファイルドラッグ&ドロップ
        const fileInputContainer = document.getElementById('fileInputContainer');
        const fileInput = document.getElementById('csvFile');
        const analyzeButton = document.getElementById('analyzeButton');

        fileInputContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileInputContainer.classList.add('dragover');
        });

        fileInputContainer.addEventListener('dragleave', () => {
            fileInputContainer.classList.remove('dragover');
        });

        fileInputContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            fileInputContainer.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                analyzeButton.style.display = 'inline-block';
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                analyzeButton.style.display = 'inline-block';
            }
        });

        async function analyzeCSV() {
            const file = fileInput.files[0];
            if (!file) {
                showError('ファイルを選択してください');
                return;
            }

            showLoading(true);
            hideError();

            try {
                const formData = new FormData();
                formData.append('csvFile', file);

                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('データの分析に失敗しました');
                }

                const data = await response.json();
                currentData = data;
                displayDashboard(data);
            } catch (error) {
                showError('エラー: ' + error.message);
            } finally {
                showLoading(false);
            }
        }



        function displayDashboard(data) {
            // 統計情報の表示
            document.getElementById('totalSales').textContent = formatCurrency(data.summary.totalSales);
            document.getElementById('totalProfit').textContent = formatCurrency(data.summary.totalProfit);
            document.getElementById('totalOrders').textContent = data.summary.totalOrders.toLocaleString();
            document.getElementById('totalFees').textContent = formatCurrency(data.summary.totalFees);

            // 月別グラフ
            displayMonthlyChart(data.monthlyTrends);

            // 費用内訳グラフ
            displayFeeChart(data.feeBreakdown);

            // SKUテーブル
            displaySkuTable(data.skuAnalysis);

            // ダッシュボード表示
            document.getElementById('dashboard').classList.add('active');
        }

        function displayMonthlyChart(trends) {
            const ctx = document.getElementById('monthlyChart').getContext('2d');

            if (monthlyChart) {
                monthlyChart.destroy();
            }

            monthlyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: trends.map(t => t.month),
                    datasets: [{
                        label: '売上',
                        data: trends.map(t => t.sales),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }, {
                        label: '利益',
                        data: trends.map(t => t.profit),
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '¥' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        }

        function displayFeeChart(feeBreakdown) {
            const ctx = document.getElementById('feeChart').getContext('2d');

            if (feeChart) {
                feeChart.destroy();
            }

            feeChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Amazon手数料', '広告費', '返品額', 'FBA保管料', 'その他'],
                    datasets: [{
                        data: [
                            feeBreakdown.amazonFees,
                            feeBreakdown.advertisingCosts,
                            feeBreakdown.returnAmount,
                            feeBreakdown.fbaStorageFees,
                            feeBreakdown.otherFees
                        ],
                        backgroundColor: [
                            '#667eea',
                            '#ff6b6b',
                            '#ffa500',
                            '#20c997',
                            '#6f42c1'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        function displaySkuTable(skuAnalysis) {
            const tbody = document.getElementById('skuTableBody');
            tbody.innerHTML = '';

            skuAnalysis.slice(0, 10).forEach(sku => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td>\${sku.sku}</td>
                    <td>\${sku.description.length > 30 ? sku.description.substring(0, 30) + '...' : sku.description}</td>
                    <td>\${formatCurrency(sku.totalSales)}</td>
                    <td>\${formatCurrency(sku.totalProfit)}</td>
                    <td>\${sku.totalQuantity}</td>
                    <td>\${formatCurrency(sku.averageSellingPrice)}</td>
                    <td>\${sku.profitMargin.toFixed(1)}%</td>
                \`;
                tbody.appendChild(row);
            });
        }

        function formatCurrency(amount) {
            return '¥' + Math.round(amount).toLocaleString();
        }

        function showLoading(show) {
            document.getElementById('loading').style.display = show ? 'block' : 'none';
        }

        function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        function hideError() {
            document.getElementById('error').style.display = 'none';
        }
    </script>
</body>
</html>
  `;
}



export default app;
