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

// ヘルスチェックAPI
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
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

    console.log('📁 Processing CSV file:', csvFile.name, 'Size:', csvFile.size);

    // ファイルサイズチェック (10MB制限)
    if (csvFile.size > 10 * 1024 * 1024) {
      console.log('❌ File too large:', csvFile.size);
      return c.json({ error: 'ファイルサイズが大きすぎます (10MB以下にしてください)' }, 400);
    }

    const csvText = await csvFile.text();
    console.log('📝 CSV text length:', csvText.length);

    const transactions = parseCSVText(csvText);
    console.log(`📊 Parsed ${transactions.length} transactions`);

    if (transactions.length === 0) {
      console.log('❌ No transactions found');
      return c.json({ error: '有効な取引データが見つかりません' }, 400);
    }

    const dashboardData = analyzeTransactions(transactions);
    console.log('✅ Analysis completed successfully');

    return c.json(dashboardData);
  } catch (error) {
    console.error('❌ CSV解析エラー:', error);
    return c.json({
      error: 'CSV解析中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error))
    }, 500);
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

        .chart-container canvas {
            max-height: 400px;
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

        .table-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .table-controls button {
            padding: 0.5rem 1rem;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9rem;
        }

        .table-controls button:hover {
            background: #5a6fd8;
        }

        .negative-value {
            color: #e74c3c;
            font-weight: bold;
        }

        .sku-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
            font-size: 0.9rem;
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

            .sku-table-container {
                overflow-x: auto;
            }

            .sku-table {
                font-size: 0.8rem;
                min-width: 1400px;
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
                <span id="fileName" style="color: #666; font-size: 0.9em; display: block; margin-top: 5px;"></span>
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
                <div class="chart-container">
                    <canvas id="skuChart"></canvas>
                </div>
                <div class="table-controls">
                    <button id="showAllSkus" onclick="toggleSkuView()">全SKU表示</button>
                    <span id="skuCountDisplay">上位10商品を表示中</span>
                </div>
                <table class="sku-table">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>商品名</th>
                            <th>売上</th>
                            <th>利益</th>
                            <th>返金額</th>
                            <th>販売数</th>
                            <th>返品数</th>
                            <th>その他手数料</th>
                            <th>FBA手数料</th>
                            <th>利益率</th>
                            <th>返品率</th>
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
        let skuChart = null;
        let showAllSkus = false;
        let droppedFile = null; // ドロップされたファイルを保持

        // サーバー接続確認
        async function checkServerConnection() {
            try {
                const response = await fetch('/api/health');
                if (response.ok) {
                    console.log('✅ Server connection OK');
                    return true;
                } else {
                    console.log('❌ Server connection failed');
                    return false;
                }
            } catch (error) {
                console.error('❌ Server connection error:', error);
                return false;
            }
        }

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
                const file = files[0];
                console.log('📁 File dropped:', file.name);
                console.log('📊 File size:', file.size, 'bytes (', (file.size / 1024 / 1024).toFixed(2), 'MB)');
                console.log('📋 File type:', file.type);

                // ドロップされたファイルを保持（FileListの直接代入は多くのブラウザで制限される）
                droppedFile = file;
                console.log('✅ Dropped file stored:', droppedFile.name);

                // FileListも試してみる（可能であれば）
                try {
                    fileInput.files = files;
                    console.log('✅ FileList assigned successfully');
                } catch (error) {
                    console.warn('⚠️ FileList assignment failed (using droppedFile instead):', error);
                }

                analyzeButton.style.display = 'inline-block';

                // ファイル名を表示
                const fileNameSpan = document.getElementById('fileName');
                if (fileNameSpan) {
                    fileNameSpan.textContent = file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + 'MB)';
                }
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                droppedFile = null; // ドロップされたファイルをリセット
                console.log('📁 File selected:', fileInput.files[0].name);
                analyzeButton.style.display = 'inline-block';

                // ファイル名を表示
                const fileNameSpan = document.getElementById('fileName');
                if (fileNameSpan) {
                    fileNameSpan.textContent = fileInput.files[0].name;
                }
            }
        });

        async function analyzeCSV() {
            // ドロップされたファイルを優先的に使用
            const file = droppedFile || fileInput.files[0];
            if (!file) {
                showError('ファイルを選択してください');
                return;
            }

            console.log('📊 Starting analysis for file:', file.name, 'Size:', file.size);
            console.log('📊 File source:', droppedFile ? 'Dropped' : 'Selected');

            showLoading(true);
            hideError();

            // サーバー接続確認
            const isConnected = await checkServerConnection();
            if (!isConnected) {
                showError('サーバーに接続できません。サーバーが起動していることを確認してください。');
                showLoading(false);
                return;
            }

            try {
                const formData = new FormData();
                formData.append('csvFile', file);

                console.log('📤 Sending CSV file to server:', file.name);
                console.log('📊 File size:', file.size, 'bytes');
                console.log('📋 File type:', file.type);
                console.log('📋 File last modified:', new Date(file.lastModified).toISOString());
                console.log('📋 FormData entries:');
                for (let pair of formData.entries()) {
                    console.log('  ', pair[0], ':', pair[1]);
                }

                console.log('🚀 Making fetch request to /api/analyze');
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    body: formData
                });

                console.log('📡 Server response status:', response.status);
                console.log('📡 Server response headers:', response.headers);
                console.log('📡 Server response ok:', response.ok);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ Server error:', errorText);
                    throw new Error('サーバーエラー (' + response.status + '): ' + errorText);
                }

                const data = await response.json();
                console.log('✅ Analysis completed successfully');
                currentData = data;
                displayDashboard(data);
            } catch (error) {
                console.error('❌ Analysis error:', error);
                console.error('❌ Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });

                if (error.message.includes('Failed to fetch')) {
                    // より詳細なエラー診断
                    try {
                        const healthCheck = await fetch('/api/health');
                        if (healthCheck.ok) {
                            showError('サーバーは動作していますが、ファイルのアップロードに失敗しました。ファイルサイズが大きすぎる可能性があります。');
                        } else {
                            showError('サーバーに接続できません。サーバーが起動していることを確認してください。');
                        }
                    } catch {
                        showError('サーバーに接続できません。サーバーが起動していることを確認してください。');
                    }
                } else {
                    showError('エラー: ' + error.message);
                }
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

            // SKUチャート
            displaySkuChart(data.skuAnalysis);

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
                    }, {
                        label: '手数料',
                        data: trends.map(t => t.fees),
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
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

        function displaySkuChart(skuAnalysis) {
            const ctx = document.getElementById('skuChart').getContext('2d');

            if (skuChart) {
                skuChart.destroy();
            }

            // 上位10SKUを取得
            const topSkus = skuAnalysis.slice(0, 10);

            const skuLabels = topSkus.map(sku => sku.sku);
            const profitData = topSkus.map(sku => sku.totalProfit);
            const returnData = topSkus.map(sku => Math.abs(sku.returnAmount)); // 絶対値で表示
            const otherFeesData = topSkus.map(sku => Math.abs(sku.amazonFees)); // 絶対値で表示
            const fbaFeesData = topSkus.map(sku => Math.abs(sku.fbaFees)); // 絶対値で表示

            // 合計額を計算
            const totalAmounts = topSkus.map(sku =>
                sku.totalProfit + Math.abs(sku.returnAmount) + Math.abs(sku.amazonFees) + Math.abs(sku.fbaFees)
            );

            skuChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: skuLabels,
                    datasets: [
                        {
                            label: '利益',
                            data: profitData,
                            backgroundColor: 'rgba(46, 204, 113, 0.8)',
                            borderColor: 'rgba(46, 204, 113, 1)',
                            borderWidth: 1
                        },
                        {
                            label: '返金額',
                            data: returnData,
                            backgroundColor: 'rgba(231, 76, 60, 0.8)',
                            borderColor: 'rgba(231, 76, 60, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'その他手数料',
                            data: otherFeesData,
                            backgroundColor: 'rgba(230, 126, 34, 0.8)',
                            borderColor: 'rgba(230, 126, 34, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'FBA手数料',
                            data: fbaFeesData,
                            backgroundColor: 'rgba(52, 152, 219, 0.8)',
                            borderColor: 'rgba(52, 152, 219, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'SKU別売上構成（上位10商品）'
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                footer: function(context) {
                                    const index = context[0].dataIndex;
                                    const total = totalAmounts[index];
                                    return '合計: ¥' + total.toLocaleString();
                                }
                            }
                        },
                        datalabels: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'SKU'
                            }
                        },
                        y: {
                            stacked: true,
                            title: {
                                display: true,
                                text: '金額 (¥)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return '¥' + value.toLocaleString();
                                }
                            }
                        }
                    }
                },
                plugins: [{
                    afterDatasetsDraw: function(chart) {
                        const ctx = chart.ctx;
                        ctx.font = '12px Arial';
                        ctx.fillStyle = '#333';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';

                        chart.data.datasets[0].data.forEach((value, index) => {
                            const meta = chart.getDatasetMeta(0);
                            const bar = meta.data[index];
                            const total = totalAmounts[index];

                            // 最上位のバーの位置を取得
                            let topY = bar.y;
                            for (let i = 1; i < chart.data.datasets.length; i++) {
                                const dataset = chart.getDatasetMeta(i);
                                if (dataset.data[index] && dataset.data[index].y < topY) {
                                    topY = dataset.data[index].y;
                                }
                            }

                            ctx.fillText('¥' + total.toLocaleString(), bar.x, topY - 5);
                        });
                    }
                }]
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

            const displayCount = showAllSkus ? skuAnalysis.length : 10;
            const skusToShow = skuAnalysis.slice(0, displayCount);

            skusToShow.forEach(sku => {
                const row = document.createElement('tr');
                const returnRate = sku.salesCount > 0 ? (sku.returnCount / sku.salesCount * 100) : 0;
                row.innerHTML = \`
                    <td>\${sku.sku}</td>
                    <td>\${sku.description.length > 15 ? sku.description.substring(0, 15) + '...' : sku.description}</td>
                    <td>\${formatCurrency(sku.totalSales)}</td>
                    <td>\${formatCurrency(sku.totalProfit)}</td>
                    <td>\${formatCurrency(sku.returnAmount)}</td>
                    <td>\${sku.salesCount}</td>
                    <td>\${sku.returnCount}</td>
                    <td>\${formatCurrency(sku.amazonFees)}</td>
                    <td>\${formatCurrency(sku.fbaFees)}</td>
                    <td>\${formatPercentage(sku.profitMargin)}</td>
                    <td>\${formatPercentage(returnRate)}</td>
                \`;
                tbody.appendChild(row);
            });

            // 表示件数の更新
            document.getElementById('skuCountDisplay').textContent =
                showAllSkus ? \`全\${skuAnalysis.length}商品を表示中\` : '上位10商品を表示中';
        }

        function toggleSkuView() {
            showAllSkus = !showAllSkus;
            const button = document.getElementById('showAllSkus');
            button.textContent = showAllSkus ? '上位10商品表示' : '全SKU表示';

            if (currentData) {
                displaySkuTable(currentData.skuAnalysis);
            }
        }

        function formatCurrency(amount) {
            const rounded = Math.round(amount);
            const formatted = '¥' + rounded.toLocaleString();
            return amount < 0 ? \`<span class="negative-value">\${formatted}</span>\` : formatted;
        }

        function formatPercentage(value) {
            const formatted = value.toFixed(1) + '%';
            return value < 0 ? \`<span class="negative-value">\${formatted}</span>\` : formatted;
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
