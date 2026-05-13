import { NextResponse } from "next/server";
import { addTrip } from "@/data/trips";

const DISCOUNT_CODES: Record<string, number> = {
    LOYAL10: 0.1,
    VIP20: 0.2,
    STAFF50: 0.5,
};

/**
 * @swagger
 * /api/trips/discount:
 *   post:
 *     summary: Book a trip with a loyalty discount
 *     description: Accepts the same JSON fields as POST /api/trips plus discountCode. Applies the configured percentage to totalPrice before the trip is stored.
 *     tags: [Trips]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [experienceTitle, date, passengers, totalPrice, discountCode]
 *             properties:
 *               experienceTitle: { type: string }
 *               date:            { type: string, format: date }
 *               passengers:      { type: integer, minimum: 1 }
 *               totalPrice:      { type: number, minimum: 0 }
 *               discountCode:    { type: string, enum: [LOYAL10, VIP20, STAFF50] }
 *     responses:
 *       201:
 *         description: Trip booked successfully with discount applied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 experienceTitle:
 *                   type: string
 *                 date:
 *                   type: string
 *                   format: date
 *                 passengers:
 *                   type: integer
 *                 totalPrice:
 *                   type: number
 *                   description: Persisted price after the discount is applied
 *                 savedAt:
 *                   type: string
 *                   format: date-time
 *                 originalPrice:
 *                   type: number
 *                   description: Client-submitted totalPrice before the discount
 *                 discountedPrice:
 *                   type: number
 *                   description: totalPrice after discount (matches stored totalPrice)
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *       404:
 *         description: Discount booking is disabled (DISCOUNT_CODES_ENABLED is not true)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 */
export async function POST(request: Request) {
    if (process.env.DISCOUNT_CODES_ENABLED !== "true") {
        return NextResponse.json(
            { error: "Feature not available" },
            { status: 404 },
        );
    }

    const body = await request.json();

    if (!body.discountCode) {
        return NextResponse.json(
            { error: "discountCode is required" },
            { status: 400 },
        );
    }

    const discountRate = DISCOUNT_CODES[body.discountCode];
    if (discountRate === undefined) {
        return NextResponse.json(
            { error: "Invalid discount code" },
            { status: 400 },
        );
    }

    if (
        !body.experienceTitle ||
        !body.date ||
        !body.passengers ||
        !body.totalPrice
    ) {
        return NextResponse.json(
            {
                error:
                    "Missing required fields: experienceTitle, date, passengers, totalPrice",
            },
            { status: 400 },
        );
    }

    const originalPrice = body.totalPrice;
    const discountedPrice = Number(
        (originalPrice * (1 - discountRate)).toFixed(2),
    );

    const newTrip = addTrip({
        experienceTitle: body.experienceTitle,
        date: body.date,
        passengers: body.passengers,
        totalPrice: discountedPrice,
    });

    return NextResponse.json(
        { ...newTrip, originalPrice, discountedPrice },
        { status: 201 },
    );
}
