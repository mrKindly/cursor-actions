import { NextResponse } from 'next/server';
import { EXPERIENCE_DATA } from '@/data/experience';

/**
 * @swagger
 * /api/experience:
 *   get:
 *     summary: Retrieve experience data
 *     description: Returns the static data for the Coastal Boat Trip experience, including features, amenities, and availability details.
 *     responses:
 *       200:
 *         description: A successful response containing the experience data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   example: "Coastal Boat Trip"
 *                 subtitle:
 *                   type: string
 *                   example: "Signature Experience"
 *                 duration:
 *                   type: string
 *                   example: "4 Hours"
 *                 location:
 *                   type: string
 *                   example: "Marina Port"
 *                 pricePerPerson:
 *                   type: number
 *                   example: 129
 *                 portTaxes:
 *                   type: number
 *                   example: 24
 *                 maxPassengers:
 *                   type: number
 *                   example: 12
 */
export async function GET() {
  // Simulate a bit of network latency
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return NextResponse.json(EXPERIENCE_DATA);
}
