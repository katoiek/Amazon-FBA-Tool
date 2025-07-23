import { AmazonTransaction, SkuAnalysis, DashboardData } from '../types';

export function parseCSVText(csvText: string): AmazonTransaction[] {
  // BOM（Byte Order Mark）を削除
  const cleanedText = csvText.replace(/^\ufeff/, '');
  const lines = cleanedText.split('\n');
  const transactions: AmazonTransaction[] = [];

  console.log('📊 CSV lines count:', lines.length);
  console.log('📊 First 10 lines:');
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    console.log(`Line ${i}: ${lines[i]}`);
  }

  // ヘッダー行を見つける（8行目）
  const headerLineIndex = 7;
  const dataStartIndex = 8;

  if (lines.length <= dataStartIndex) {
    console.log('❌ Not enough lines in CSV file');
    return transactions;
  }

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = parseCSVLine(line);
    if (columns.length < 26) continue;

    try {
      const transaction: AmazonTransaction = {
        date: columns[0] || '',
        paymentId: columns[1] || '',
        transactionType: columns[2] || '',
        orderId: columns[3] || '',
        sku: columns[4] || '',
        description: columns[5] || '',
        quantity: parseInt(columns[6]) || 0,
        amazonService: columns[7] || '',
        fulfillment: columns[8] || '',
        city: columns[9] || '',
        prefecture: columns[10] || '',
        postalCode: columns[11] || '',
        taxCollectionType: columns[12] || '',
        productSales: parseAmount(columns[13]) || 0,
        productTax: parseAmount(columns[14]) || 0,
        shippingFee: parseAmount(columns[15]) || 0,
        shippingTax: parseAmount(columns[16]) || 0,
        giftWrappingFee: parseAmount(columns[17]) || 0,
        giftWrappingTax: parseAmount(columns[18]) || 0,
        amazonPointsCost: parseAmount(columns[19]) || 0,
        promotionDiscount: parseAmount(columns[20]) || 0,
        promotionDiscountTax: parseAmount(columns[21]) || 0,
        marketplaceTax: parseAmount(columns[22]) || 0,
        fees: parseAmount(columns[23]) || 0,
        fbaFees: parseAmount(columns[24]) || 0,
        otherTransactionFees: parseAmount(columns[25]) || 0,
        other: parseAmount(columns[26]) || 0,
        total: parseAmount(columns[27]) || 0,
      };

      transactions.push(transaction);
    } catch (error) {
      console.error('Error parsing line:', i, error);
    }
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseAmount(value: string): number {
  if (!value) return 0;

  // カンマとクォーテーションを除去
  const cleaned = value.replace(/[,"]/g, '');

  // 数値に変換
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function createDefaultMonthlyData() {
  return {
    sales: 0,
    profit: 0,
    fees: 0,
    amazonFees: 0,
    fbaFees: 0,
    otherFees: 0,
    advertisingCosts: 0
  };
}

export function analyzeTransactions(transactions: AmazonTransaction[]): DashboardData {
  const skuMap = new Map<string, SkuAnalysis>();
  const monthlyMap = new Map<string, {
    sales: number;
    profit: number;
    fees: number;
    amazonFees: number;
    fbaFees: number;
    otherFees: number;
    advertisingCosts: number;
  }>();

  let totalSales = 0;
  let totalProfit = 0;
  let totalOrders = 0;
  let totalFees = 0;
  let amazonFees = 0;
  let advertisingCosts = 0;
  let returnAmount = 0;
  let fbaStorageFees = 0;
  let otherFees = 0;

  transactions.forEach(transaction => {
    const { sku, description, productSales, total, fees, fbaFees, otherTransactionFees, other, transactionType, date } = transaction;

    // 注文タイプのトランザクションのみ集計
    if (transactionType === '注文') {
      totalSales += productSales;
      totalProfit += total;
      totalOrders += 1;
      totalFees += Math.abs(fees) + Math.abs(fbaFees);
      amazonFees += Math.abs(fees);

      // SKU別分析
      if (sku) {
        const existing = skuMap.get(sku) || {
          sku,
          description,
          totalSales: 0,
          totalProfit: 0,
          totalQuantity: 0,
          salesCount: 0,
          returnAmount: 0,
          returnCount: 0,
          amazonFees: 0,
          fbaFees: 0,
          advertisingCosts: 0,
          fbaStorageFees: 0,
          otherFees: 0,
          averageSellingPrice: 0,
          profitMargin: 0,
        };

        existing.totalSales += productSales;
        existing.totalProfit += total;
        existing.totalQuantity += transaction.quantity;
        existing.salesCount += 1;
        existing.amazonFees += fees; // マイナス値として保持
        existing.fbaFees += fbaFees; // マイナス値として保持
        existing.otherFees += otherTransactionFees; // マイナス値として保持

        skuMap.set(sku, existing);
      }

      // 月別データ
      const month = date.substring(0, 7); // YYYY/MM
      const monthlyData = monthlyMap.get(month) || createDefaultMonthlyData();
      monthlyData.sales += productSales;
      monthlyData.profit += total;
      monthlyData.fees += Math.abs(fees) + Math.abs(fbaFees); // 手数料の合計を追加
      monthlyData.amazonFees += Math.abs(fees); // Amazon手数料を追加
      monthlyData.fbaFees += Math.abs(fbaFees); // FBA手数料を追加
      monthlyData.otherFees += Math.abs(otherTransactionFees); // その他の手数料を追加
      monthlyMap.set(month, monthlyData);
    }

    // 広告費用
    if (transactionType === '注文外料金' && transaction.description.includes('広告費用')) {
      advertisingCosts += Math.abs(other);

      // 月別データ（広告費用）
      const month = date.substring(0, 7);
      const monthlyData = monthlyMap.get(month) || createDefaultMonthlyData();
      monthlyData.advertisingCosts += Math.abs(other);
      monthlyMap.set(month, monthlyData);
    }

    // 返金
    if (transactionType === '返金') {
      returnAmount += Math.abs(total);

      // SKU別返金データ
      if (sku) {
        const existing = skuMap.get(sku);
        if (existing) {
          existing.returnAmount += total; // マイナス値として保持
          existing.returnCount += 1;
          skuMap.set(sku, existing);
        }
      }

      // 月別データ（返金）
      const month = date.substring(0, 7);
      const monthlyData = monthlyMap.get(month) || createDefaultMonthlyData();
      monthlyData.profit += total; // 返金はマイナス値なので利益から引く
      monthlyMap.set(month, monthlyData);
    }

    // FBA保管手数料
    if (transactionType === 'FBA 在庫関連の手数料') {
      fbaStorageFees += Math.abs(other);

      // SKU別FBA保管手数料
      if (sku) {
        const existing = skuMap.get(sku);
        if (existing) {
          existing.fbaStorageFees += other; // マイナス値として保持
          skuMap.set(sku, existing);
        }
      }
    }

    // 広告費用もSKU別に集計
    if (transactionType === '注文外料金' && transaction.description.includes('広告費用')) {
      if (sku) {
        const existing = skuMap.get(sku);
        if (existing) {
          existing.advertisingCosts += other; // マイナス値として保持
          skuMap.set(sku, existing);
        }
      }
    }

    // その他の手数料
    if (transactionType === 'FBA 在庫関連の手数料' && !transaction.description.includes('FBA在庫保管手数料')) {
      otherFees += Math.abs(other);
    }
  });

  // SKU分析の計算を完了
  const skuAnalysis = Array.from(skuMap.values()).map(sku => ({
    ...sku,
    averageSellingPrice: sku.totalQuantity > 0 ? sku.totalSales / sku.totalQuantity : 0,
    profitMargin: sku.totalSales > 0 ? (sku.totalProfit / sku.totalSales) * 100 : 0,
  })).sort((a, b) => b.totalSales - a.totalSales);

  // 月別データをソート
  const monthlyTrends = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    summary: {
      totalSales,
      totalProfit,
      totalOrders,
      totalFees,
    },
    skuAnalysis,
    monthlyTrends,
    feeBreakdown: {
      amazonFees,
      advertisingCosts,
      returnAmount,
      fbaStorageFees,
      otherFees,
    },
  };
}
