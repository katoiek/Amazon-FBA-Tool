export interface AmazonTransaction {
  date: string;
  paymentId: string;
  transactionType: string;
  orderId: string;
  sku: string;
  description: string;
  quantity: number;
  amazonService: string;
  fulfillment: string;
  city: string;
  prefecture: string;
  postalCode: string;
  taxCollectionType: string;
  productSales: number;
  productTax: number;
  shippingFee: number;
  shippingTax: number;
  giftWrappingFee: number;
  giftWrappingTax: number;
  amazonPointsCost: number;
  promotionDiscount: number;
  promotionDiscountTax: number;
  marketplaceTax: number;
  fees: number;
  fbaFees: number;
  otherTransactionFees: number;
  other: number;
  total: number;
}

export interface SkuAnalysis {
  sku: string;
  description: string;
  totalSales: number;
  totalProfit: number;
  totalQuantity: number;
  salesCount: number;
  returnAmount: number;
  returnCount: number;
  amazonFees: number;
  fbaFees: number;
  advertisingCosts: number;
  fbaStorageFees: number;
  otherFees: number;
  averageSellingPrice: number;
  profitMargin: number;
}

export interface DashboardData {
  summary: {
    totalSales: number;
    totalProfit: number;
    totalOrders: number;
    totalFees: number;
  };
  skuAnalysis: SkuAnalysis[];
  monthlyTrends: {
    month: string;
    sales: number;
    profit: number;
    fees: number;
    amazonFees: number;
    fbaFees: number;
    otherFees: number;
    advertisingCosts: number;
  }[];
  feeBreakdown: {
    amazonFees: number;
    advertisingCosts: number;
    returnAmount: number;
    fbaStorageFees: number;
    otherFees: number;
  };
}
