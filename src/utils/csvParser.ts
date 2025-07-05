import { AmazonTransaction, SkuAnalysis, DashboardData } from '../types';

export function parseCSVText(csvText: string): AmazonTransaction[] {
  // BOM（Byte Order Mark）を削除
  const cleanedText = csvText.replace(/^\ufeff/, '');
  const lines = cleanedText.split('\n');
  const transactions: AmazonTransaction[] = [];

  // ヘッダー行を見つける（8行目）
  const headerLineIndex = 7;
  const dataStartIndex = 8;

  if (lines.length <= dataStartIndex) {
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

export function analyzeTransactions(transactions: AmazonTransaction[]): DashboardData {
  const skuMap = new Map<string, SkuAnalysis>();
  const monthlyMap = new Map<string, { sales: number; profit: number }>();

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
          amazonFees: 0,
          advertisingCosts: 0,
          returnAmount: 0,
          fbaStorageFees: 0,
          otherFees: 0,
          averageSellingPrice: 0,
          profitMargin: 0,
        };

        existing.totalSales += productSales;
        existing.totalProfit += total;
        existing.totalQuantity += transaction.quantity;
        existing.amazonFees += Math.abs(fees);
        existing.fbaStorageFees += Math.abs(fbaFees);
        existing.otherFees += Math.abs(otherTransactionFees);

        skuMap.set(sku, existing);
      }

      // 月別データ
      const month = date.substring(0, 7); // YYYY/MM
      const monthlyData = monthlyMap.get(month) || { sales: 0, profit: 0 };
      monthlyData.sales += productSales;
      monthlyData.profit += total;
      monthlyMap.set(month, monthlyData);
    }

    // 広告費用
    if (transactionType === '注文外料金' && transaction.description.includes('広告費用')) {
      advertisingCosts += Math.abs(other);
    }

    // 返金
    if (transactionType === '返金') {
      returnAmount += Math.abs(total);
    }

    // FBA保管手数料
    if (transactionType === 'FBA 在庫関連の手数料') {
      fbaStorageFees += Math.abs(other);
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
