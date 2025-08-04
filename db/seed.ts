import { db } from "./index";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

async function seed() {
  try {
    console.log("Seeding database...");

    // Create example tours
    const tours = [
      {
        provider: "travelata",
        externalId: "100001",
        title: "Sunrise Resort & Spa",
        description: "Современный отель класса люкс на первой линии с собственным песчаным пляжем. Полная реновация номеров в 2022 году. К услугам гостей 3 бассейна, SPA-центр, фитнес-зал, 4 ресторана, детский клуб с анимацией.",
        destination: "turkey",
        hotel: "Sunrise Resort & Spa",
        hotelStars: 5,
        price: 89500,
        priceOld: 120000,
        rating: 4.8,
        startDate: new Date("2024-06-01"),
        endDate: new Date("2024-06-08"),
        nights: 7,
        roomType: "Standard Room",
        mealType: "All Inclusive",
        beachLine: "First Line",
        link: "https://example.com/tour/100001",
        image: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80",
        metadata: {
          airport: "Antalya (AYT)",
          reviews: 253,
          renovationYear: 2022
        },
        matchScore: 87
      },
      {
        provider: "sletat",
        externalId: "100002",
        title: "Royal Paradise Resort",
        description: "Комфортабельный отель с прямым выходом к морю и большой зеленой территорией. Разнообразное питание, анимация для детей и взрослых, просторные номера.",
        destination: "egypt",
        hotel: "Royal Paradise Resort",
        hotelStars: 4,
        price: 82300,
        priceOld: 105000,
        rating: 4.5,
        startDate: new Date("2024-06-10"),
        endDate: new Date("2024-06-20"),
        nights: 10,
        roomType: "Superior Room",
        mealType: "Half Board",
        beachLine: "First Line",
        link: "https://example.com/tour/100002",
        image: "https://images.unsplash.com/photo-1603470227641-0025cec48ea7?auto=format&fit=crop&w=800&q=80",
        metadata: {
          airport: "Sharm El Sheikh (SSH)",
          reviews: 187,
          renovationYear: 2020
        },
        matchScore: 72
      }
    ];

    // Check if data already exists before inserting
    const existingToursCount = await db.select({ count: sql<number>`count(*)` }).from(schema.tours);
    if (existingToursCount[0].count === 0) {
      console.log("Inserting sample tours...");
      await db.insert(schema.tours).values(tours);
      console.log(`Added ${tours.length} sample tours`);
    } else {
      console.log("Tours already exist, skipping sample tour insertion");
    }

    console.log("Seeding completed successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
