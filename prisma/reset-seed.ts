/**
 * reset-seed.ts
 *
 * Wipes every table in the database then seeds two fresh demo accounts:
 *   - Provider: +2348012345678 (Emeka Okafor — plumber, Lagos)
 *   - Customer: +2348087654321 (Adaeze Nwosu — Lagos)
 *
 * The provider gets one APPROVED + published plumbing service so it appears
 * in the Home feed immediately. All categories are re-seeded so the rest of
 * the app (category browser, create-service flow) works correctly.
 *
 * Usage:
 *   npm run db:fresh
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Demo phones ─────────────────────────────────────────────────────────────

const PHONES = {
  provider: '+2348012345678',
  customer: '+2348087654321',
};

// ─── Full category tree ───────────────────────────────────────────────────────

const CATEGORIES = [
  {
    name: 'Home Services',
    slug: 'home-services',
    description: 'Plumbers, electricians, carpenters and other home repair professionals',
    sortOrder: 1,
    subcategories: [
      { name: 'Plumbing',              description: 'Pipe repairs, installations & drainage' },
      { name: 'Electrical',            description: 'Wiring, fuse boards & installations' },
      { name: 'Carpentry',             description: 'Furniture, doors, cabinets & woodwork' },
      { name: 'Painting & Decorating', description: 'Interior and exterior painting' },
      { name: 'Cleaning',              description: 'House, office and deep cleaning' },
      { name: 'Tiling & Flooring',     description: 'Floor tiles, screeding & finishes' },
      { name: 'General Repairs',       description: 'Handyman and general maintenance' },
      { name: 'Roofing',               description: 'Roof repairs and waterproofing' },
      { name: 'AC & Appliance Repair', description: 'Air conditioners, fridges & electronics' },
      { name: 'CCTV & Security',       description: 'Camera installation & alarm systems' },
      { name: 'Interior Design',       description: 'Home decoration and space planning' },
      { name: 'Fumigation & Pest',     description: 'Pest control and fumigation' },
    ],
  },
  {
    name: 'Beauty & Wellness',
    slug: 'beauty-wellness',
    description: 'Hair, makeup, nails and wellness professionals',
    sortOrder: 2,
    subcategories: [
      { name: 'Hair Styling',    description: 'Braids, weaves, natural hair & treatments' },
      { name: 'Barbing',         description: 'Haircuts, fades and beard grooming' },
      { name: 'Makeup',          description: 'Bridal, glam and everyday makeup' },
      { name: 'Nail Care',       description: 'Manicures, pedicures & nail art' },
      { name: 'Massage Therapy', description: 'Swedish, deep tissue & relaxation massage' },
      { name: 'Skincare',        description: 'Facials, chemical peels & skincare routines' },
      { name: 'Lashes & Brows',  description: 'Lash extensions, microblading & brow shaping' },
      { name: 'Waxing',          description: 'Body and facial waxing' },
    ],
  },
  {
    name: 'Food & Catering',
    slug: 'food-catering',
    description: 'Private chefs, caterers and food vendors',
    sortOrder: 3,
    subcategories: [
      { name: 'Private Chef',    description: 'Personal chef for home or events' },
      { name: 'Event Catering',  description: 'Parties, weddings & corporate events' },
      { name: 'Baking & Pastry', description: 'Custom cakes, pastries & bread' },
      { name: 'Small Chops',     description: 'Party snacks and finger food' },
      { name: 'Meal Prep',       description: 'Weekly meal preparation and delivery' },
    ],
  },
  {
    name: 'Creative & Media',
    slug: 'creative-media',
    description: 'Photographers, designers, videographers and content creators',
    sortOrder: 4,
    subcategories: [
      { name: 'Photography',      description: 'Events, portraits & product photography' },
      { name: 'Videography',      description: 'Event coverage and film production' },
      { name: 'Graphic Design',   description: 'Logos, branding & print design' },
      { name: 'Video Editing',    description: 'Post-production and colour grading' },
      { name: 'Content Creation', description: 'Social media content and strategy' },
      { name: 'Animation',        description: '2D/3D animation and motion graphics' },
    ],
  },
  {
    name: 'Auto & Mechanics',
    slug: 'auto-mechanics',
    description: 'Car repairs, detailing and roadside assistance',
    sortOrder: 5,
    subcategories: [
      { name: 'Car Repair',     description: 'Engine, gearbox and general repairs' },
      { name: 'Tyre Services',  description: 'Tyre fitting, balancing and puncture repair' },
      { name: 'Auto Detailing', description: 'Full car cleaning and polishing' },
      { name: 'Car Wash',       description: 'Hand wash and valet services' },
      { name: 'Panel Beating',  description: 'Body work, dents and spray painting' },
      { name: 'Towing',         description: 'Roadside recovery and towing' },
    ],
  },
  {
    name: 'Events & Entertainment',
    slug: 'events-entertainment',
    description: 'DJs, MCs, decorators and entertainers for your events',
    sortOrder: 6,
    subcategories: [
      { name: 'DJ Services',      description: 'Club nights, parties and events' },
      { name: 'MC & Host',        description: 'Weddings, corporate events and shows' },
      { name: 'Event Decoration', description: 'Balloon art, draping and table decor' },
      { name: 'Live Band',        description: 'Live music for events' },
      { name: 'Ushering',         description: 'Event ushers and protocol staff' },
      { name: 'Party Rentals',    description: 'Tables, chairs, tents and equipment hire' },
    ],
  },
  {
    name: 'Education & Tutoring',
    slug: 'education-tutoring',
    description: 'Academic tutors, music teachers and skills trainers',
    sortOrder: 7,
    subcategories: [
      { name: 'Academic Tutoring', description: 'Primary, secondary and university subjects' },
      { name: 'Music Lessons',     description: 'Piano, guitar, drums and vocals' },
      { name: 'Language Classes',  description: 'English, French, Yoruba, Igbo and more' },
      { name: 'Computer Training', description: 'Microsoft Office, coding and internet skills' },
      { name: 'Driving Lessons',   description: 'Learn to drive from certified instructors' },
      { name: 'Art Classes',       description: 'Drawing, painting and crafts' },
    ],
  },
  {
    name: 'Logistics & Delivery',
    slug: 'logistics-delivery',
    description: 'Dispatch riders, movers and errand runners',
    sortOrder: 8,
    subcategories: [
      { name: 'Dispatch Rider',   description: 'Fast same-day delivery across the city' },
      { name: 'Moving & Packing', description: 'House and office relocation services' },
      { name: 'Errand Running',   description: 'Grocery shopping, pick-ups and collections' },
    ],
  },
  {
    name: 'Health & Fitness',
    slug: 'health-fitness',
    description: 'Personal trainers, physiotherapists and home nurses',
    sortOrder: 9,
    subcategories: [
      { name: 'Personal Training', description: 'Home or gym-based fitness coaching' },
      { name: 'Physiotherapy',     description: 'Injury rehab and pain management' },
      { name: 'Home Nursing',      description: 'Post-op care, injections and monitoring' },
      { name: 'Yoga & Pilates',    description: 'Yoga, pilates and mindfulness sessions' },
    ],
  },
  {
    name: 'Technology',
    slug: 'technology',
    description: 'Phone repairs, computer support and smart home setup',
    sortOrder: 10,
    subcategories: [
      { name: 'Phone Repair',    description: 'Screen replacements, battery and charging port' },
      { name: 'Computer Repair', description: 'Laptops, desktops and software support' },
      { name: 'Network Setup',   description: 'WiFi installation and network configuration' },
      { name: 'Smart Home',      description: 'Smart devices, automation and home cinema' },
      { name: 'Data Recovery',   description: 'Recovering lost files and data backup' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function syncCategory(data: {
  name: string; slug: string; description?: string;
  sortOrder?: number; parentId?: string;
}) {
  const existing =
    await prisma.category.findUnique({ where: { name: data.name } }) ??
    await prisma.category.findUnique({ where: { slug: data.slug } });

  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: { ...data, parentId: data.parentId ?? null, isActive: true },
    });
  }
  return prisma.category.create({ data: { ...data, isActive: true } });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Clear all tables ───────────────────────────────────────────────────
  console.log('Clearing database...');
  await prisma.$executeRaw`
    TRUNCATE TABLE
      audit_logs,
      dispute_evidence, disputes,
      review_images, reviews,
      message_media, messages,
      conversation_participants, conversations,
      quotation_items, quotations,
      bookings,
      provider_holidays, availability_slots, availability,
      service_images, portfolio_items, portfolios,
      service_likes, saved_services, service_listings,
      follows,
      notification_preferences, notifications,
      verification_documents, verifications,
      otp_codes, refresh_tokens, user_devices, uploads,
      user_profiles, users,
      categories
    CASCADE
  `;
  console.log('✓ All tables cleared\n');

  // ── 2. Categories ─────────────────────────────────────────────────────────
  let totalSubs = 0;
  for (const cat of CATEGORIES) {
    const parent = await syncCategory({
      name:        cat.name,
      slug:        cat.slug,
      description: cat.description,
      sortOrder:   cat.sortOrder,
    });

    for (let i = 0; i < cat.subcategories.length; i++) {
      const sub    = cat.subcategories[i];
      const subSlug = `${cat.slug}-${sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
      await syncCategory({
        name:        sub.name,
        slug:        subSlug,
        description: sub.description,
        parentId:    parent.id,
        sortOrder:   i,
      });
      totalSubs++;
    }
  }
  console.log(`✓ Categories: ${CATEGORIES.length} parents · ${totalSubs} subcategories\n`);

  // ── 3. Provider (User 1) ──────────────────────────────────────────────────
  const provider = await prisma.user.create({
    data: {
      phone:           PHONES.provider,
      isPhoneVerified: true,
      isActive:        true,
      profile: {
        create: {
          firstName:      'Emeka',
          lastName:       'Okafor',
          displayName:    'Emeka Plumbing Pro',
          bio:            'Professional plumber with 8 years of experience across Lagos. Pipe repairs, installations, and emergency callouts. Available 7 days a week.',
          city:           'Lagos',
          state:          'Lagos',
          country:        'NG',
          isProvider:     true,
          avgRating:      4.8,
          totalReviews:   42,
          completedJobs:  150,
          completionRate: 95,
          responseRate:   98,
          travelRadius:   15,
        },
      },
      notificationPrefs: { create: {} },
      verification: {
        create: {
          status:     'APPROVED',
          reviewedAt: new Date(),
        },
      },
    },
  });

  // Set PostGIS location (Lagos Island: 3.3792° E, 6.5244° N)
  await prisma.$executeRaw`
    UPDATE user_profiles
    SET location = ST_SetSRID(ST_MakePoint(3.3792, 6.5244), 4326)::geography
    WHERE "userId" = ${provider.id}
  `;

  // ── 4. Service for provider ───────────────────────────────────────────────
  const homeServices = await prisma.category.findUniqueOrThrow({
    where: { slug: 'home-services' },
  });

  const service = await prisma.serviceListing.create({
    data: {
      providerId:     provider.id,
      categoryId:     homeServices.id,
      title:          'Professional Plumbing Services Lagos',
      slug:           'professional-plumbing-services-lagos-emeka',
      description:    'Expert plumbing — pipe repairs, installation, bathroom fitting and emergency callouts. Certified, insured and available 7 days a week across Lagos.',
      startingPrice:  5000,
      minPrice:       5000,
      maxPrice:       150000,
      serviceRadius:  15,
      status:         'APPROVED',
      isPublished:    true,
      reviewedAt:     new Date(),
      trendingScore:  85,
      engagementScore: 72,
      likesCount:     34,
      savesCount:     21,
      viewsCount:     420,
      images: {
        create: [
          {
            url:       'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800',
            isPrimary: true,
            sortOrder: 0,
            caption:   'Pipe repair and installation',
          },
          {
            url:       'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
            isPrimary: false,
            sortOrder: 1,
            caption:   'Bathroom fitting and fixtures',
          },
        ],
      },
      availability: {
        create: {
          slots: {
            create: [
              { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' },
              { dayOfWeek: 2, startTime: '08:00', endTime: '18:00' },
              { dayOfWeek: 3, startTime: '08:00', endTime: '18:00' },
              { dayOfWeek: 4, startTime: '08:00', endTime: '18:00' },
              { dayOfWeek: 5, startTime: '08:00', endTime: '18:00' },
              { dayOfWeek: 6, startTime: '09:00', endTime: '15:00' },
            ],
          },
        },
      },
    },
  });

  console.log(`✓ User 1 — Provider: ${provider.phone} (Emeka Okafor)`);
  console.log(`  Service: "${service.title}" [APPROVED, published]`);
  console.log(`  Slug:     ${service.slug}\n`);

  // ── 5. Customer (User 2) ──────────────────────────────────────────────────
  const customer = await prisma.user.create({
    data: {
      phone:           PHONES.customer,
      isPhoneVerified: true,
      isActive:        true,
      profile: {
        create: {
          firstName:   'Adaeze',
          lastName:    'Nwosu',
          displayName: 'Adaeze N.',
          city:        'Lagos',
          state:       'Lagos',
          country:     'NG',
        },
      },
      notificationPrefs: { create: {} },
    },
  });

  // Set PostGIS location (Victoria Island: 3.4316° E, 6.4281° N)
  await prisma.$executeRaw`
    UPDATE user_profiles
    SET location = ST_SetSRID(ST_MakePoint(3.4316, 6.4281), 4326)::geography
    WHERE "userId" = ${customer.id}
  `;

  console.log(`✓ User 2 — Customer:  ${customer.phone} (Adaeze Nwosu)\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═'.repeat(52));
  console.log('  Reset + seed complete');
  console.log('═'.repeat(52));
  console.log('  Auth: POST /api/v1/auth/send-otp → verify-otp');
  console.log('  OTP printed to backend terminal (no SMS in dev)');
  console.log('');
  console.log('  Provider: ' + PHONES.provider + '  (Emeka Okafor)');
  console.log('  Customer: ' + PHONES.customer + '  (Adaeze Nwosu)');
  console.log('═'.repeat(52));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
