import { NextResponse } from 'next/server';

const RATES: Record<string, number> = {
    USD: 1.00,
    EUR: 0.92, // Euro
    JPY: 151.45, // Japanese Yen
    GBP: 0.79, // British Pound
    CAD: 1.36, // Canadian Dollar
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const amountParam = searchParams.get('amount');
    const fromParam = searchParams.get('from')?.toUpperCase();
    const toParam = searchParams.get('to')?.toUpperCase();

    if (!amountParam || !fromParam || !toParam) {
        return NextResponse.json(
            { error: 'Missing required query parameters: amount, from, to' },
            { status: 400 }
        );
    }

    const amount = parseFloat(amountParam);
    if (isNaN(amount) || amount < 0) {
        return NextResponse.json(
            { error: 'Invalid amount parameter. Must be a positive number.' },
            { status: 400 }
        );
    }

    if (!RATES[fromParam] || !RATES[toParam]) {
        return NextResponse.json(
            {
                error: `Unsupported currency. Supported currencies: ${Object.keys(RATES).join(', ')}`
            },
            { status: 400 }
        );
    }

    const amountInUSD = amount * RATES[fromParam];
    const convertedAmount = amountInUSD / RATES[toParam];
    const conversionRate = RATES[fromParam] / RATES[toParam];

    return NextResponse.json({
        success: true,
        data: {
            from: fromParam,
            to: toParam,
            amount: amount,
            convertedAmount: Number(convertedAmount.toFixed(2)),
            exchangeRate: Number(conversionRate.toFixed(4)),
            timestamp: new Date().toISOString()
        }
    });
}