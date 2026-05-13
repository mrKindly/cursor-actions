import { NextResponse } from 'next/server';
import { addTrip, getTrips } from '@/data/trips';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.experienceTitle || !body.date || !body.passengers || !body.totalPrice) {
      return NextResponse.json(
        { error: 'Missing required trip fields: experienceTitle, date, passengers, totalPrice' },
        { status: 400 }
      );
    }

    if (body.passengers <= 0) {
      return NextResponse.json(
        { error: 'Number of passengers must be at least 1' },
        { status: 400 }
      );
    }

    if (body.totalPrice <= 0) {
      return NextResponse.json(
        { error: 'Total price must be greater than 0' },
        { status: 400 }
      );
    }

    const newTrip = addTrip({
      experienceTitle: body.experienceTitle,
      date: body.date,
      passengers: body.passengers,
      totalPrice: body.totalPrice,
    });

    return NextResponse.json(newTrip, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
