import type { UsedItem } from "./types";

const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

export const usedItemCategories = [
  "Mobiles",
  "Electronics",
  "Furniture",
  "Fashion",
  "Appliances",
  "Books & Hobbies",
  "Bikes & Scooters",
];

export const usedItems: UsedItem[] = [
  {
    id: "sh1",
    title: "iPhone 12, 128GB, PTA Approved",
    price: 68000,
    negotiable: true,
    condition: "Used - Good",
    location: "DHA Phase 6, Lahore",
    seller: "Ahmed R.",
    sellerRating: 4.8,
    postedAgo: "2 hours ago",
    image: img("iphone12-used"),
    category: "Mobiles",
    description:
      "iPhone 12 in excellent working condition, battery health 87%. Comes with box and original charger. No scratches on screen, minor wear on back corner. Genuine reason for selling: upgraded to a new phone.",
  },
  {
    id: "sh2",
    title: "L-Shape Sofa Set, 6-Seater",
    price: 45000,
    negotiable: true,
    condition: "Used - Good",
    location: "Gulshan-e-Iqbal, Karachi",
    seller: "Fatima K.",
    sellerRating: 4.6,
    postedAgo: "5 hours ago",
    image: img("sofa-set-used"),
    category: "Furniture",
    description:
      "Comfortable L-shaped sofa, fabric in good condition, no tears or stains. Selling due to house shifting. Buyer to arrange pickup, can help load onto Suzuki.",
  },
  {
    id: "sh3",
    title: "HP Core i5 Laptop, 8GB RAM, 256GB SSD",
    price: 58000,
    negotiable: false,
    condition: "Like New",
    location: "F-10, Islamabad",
    seller: "Bilal H.",
    sellerRating: 4.9,
    postedAgo: "1 day ago",
    image: img("hp-laptop-used"),
    category: "Electronics",
    description:
      "Barely used HP laptop, 10th Gen Core i5, perfect for office work and browsing. Includes original charger and laptop bag. Fixed price, genuine buyers only.",
  },
  {
    id: "sh4",
    title: "Unstitched Bridal Lehenga, Worn Once",
    price: 35000,
    negotiable: true,
    condition: "Like New",
    location: "Model Town, Lahore",
    seller: "Ayesha S.",
    sellerRating: 5.0,
    postedAgo: "3 days ago",
    image: img("bridal-lehenga"),
    category: "Fashion",
    description:
      "Heavy embroidered bridal lehenga worn once for walima. Dry cleaned and stored carefully. Original price was over Rs. 120,000. Serious buyers can inquire for detailed pictures.",
  },
  {
    id: "sh5",
    title: "Haier 1.5 Ton Inverter AC",
    price: 62000,
    negotiable: true,
    condition: "Used - Good",
    location: "Johar Town, Lahore",
    seller: "Usman T.",
    sellerRating: 4.5,
    postedAgo: "6 hours ago",
    image: img("haier-ac-used"),
    category: "Appliances",
    description:
      "3-year-old inverter AC, cooling perfectly, recently serviced. Selling because upgrading to a bigger unit. Installation kit included, buyer arranges technician for uninstall.",
  },
  {
    id: "sh6",
    title: "Honda CD 70, 2021 Model",
    price: 145000,
    negotiable: true,
    condition: "Used - Good",
    location: "Saddar, Rawalpindi",
    seller: "Kashif M.",
    sellerRating: 4.7,
    postedAgo: "1 day ago",
    image: img("honda-cd70"),
    category: "Bikes & Scooters",
    description:
      "Well-maintained CD70, first owner, all documents clear. Recent oil change and tyre replacement. Genuine mileage, no accident history.",
  },
];
