import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PHONES = {
  admin:    '+2340000000001',
  provider: '+2348012345678',
  customer: '+2348087654321',
};

// Admin dashboard login (email + password) — mobile app users never use this,
// they authenticate via phone + OTP only. See AuthService.adminLogin.
const ADMIN_EMAIL = 'admin@wokizi.com';
const ADMIN_PASSWORD = 'Wokizi@Admin123';

// ─── Category seed data ───────────────────────────────────────────────────────

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
      { name: 'Private Chef',     description: 'Personal chef for home or events' },
      { name: 'Event Catering',   description: 'Parties, weddings & corporate events' },
      { name: 'Baking & Pastry',  description: 'Custom cakes, pastries & bread' },
      { name: 'Small Chops',      description: 'Party snacks and finger food' },
      { name: 'Meal Prep',        description: 'Weekly meal preparation and delivery' },
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
      { name: 'Car Repair',      description: 'Engine, gearbox and general repairs' },
      { name: 'Tyre Services',   description: 'Tyre fitting, balancing and puncture repair' },
      { name: 'Auto Detailing',  description: 'Full car cleaning and polishing' },
      { name: 'Car Wash',        description: 'Hand wash and valet services' },
      { name: 'Panel Beating',   description: 'Body work, dents and spray painting' },
      { name: 'Towing',          description: 'Roadside recovery and towing' },
    ],
  },
  {
    name: 'Events & Entertainment',
    slug: 'events-entertainment',
    description: 'DJs, MCs, decorators and entertainers for your events',
    sortOrder: 6,
    subcategories: [
      { name: 'DJ Services',        description: 'Club nights, parties and events' },
      { name: 'MC & Host',          description: 'Weddings, corporate events and shows' },
      { name: 'Event Decoration',   description: 'Balloon art, draping and table decor' },
      { name: 'Live Band',          description: 'Live music for events' },
      { name: 'Ushering',           description: 'Event ushers and protocol staff' },
      { name: 'Party Rentals',      description: 'Tables, chairs, tents and equipment hire' },
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
      { name: 'Dispatch Rider', description: 'Fast same-day delivery across the city' },
      { name: 'Moving & Packing', description: 'House and office relocation services' },
      { name: 'Errand Running', description: 'Grocery shopping, pick-ups and collections' },
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding database...\n');

  // ── Super Admin ────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { phone: DEMO_PHONES.admin },
    update: {
      role: UserRole.SUPER_ADMIN, isActive: true, isSuspended: false,
      email: ADMIN_EMAIL, passwordHash: adminPasswordHash,
    },
    create: {
      phone: DEMO_PHONES.admin,
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      isPhoneVerified: true,
      isActive: true,
      profile: {
        create: { firstName: 'Wokizi', lastName: 'Admin', displayName: 'Wokizi Admin' },
      },
      notificationPrefs: { create: {} },
    },
  });
  console.log(`✓ Admin:    ${admin.phone} (dashboard login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`);

  // ── Categories & Subcategories ─────────────────────────────────────────────
  // Both `name` and `slug` are unique so we can't use a single upsert safely
  // when renaming/moving categories between seeds. Instead: find by either field,
  // update in-place, or create fresh.

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
        // Explicitly include parentId so promoting a subcategory to a parent
        // clears the old parentId (undefined would leave it unchanged)
        data: { ...data, parentId: data.parentId ?? null, isActive: true },
      });
    }
    return prisma.category.create({ data: { ...data, isActive: true } });
  }

  let totalSubs = 0;
  for (const cat of CATEGORIES) {
    const parent = await syncCategory({
      name:        cat.name,
      slug:        cat.slug,
      description: cat.description,
      sortOrder:   cat.sortOrder,
    });

    for (let i = 0; i < cat.subcategories.length; i++) {
      const sub = cat.subcategories[i];
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

    console.log(`✓ ${cat.name} (${cat.subcategories.length} subcategories)`);
  }
  console.log(`\n  ${CATEGORIES.length} categories · ${totalSubs} subcategories seeded\n`);

  // ── Deactivate stale top-level categories from old seed runs ───────────────
  const activeParentSlugs = CATEGORIES.map((c) => c.slug);
  const deactivated = await prisma.category.updateMany({
    where: { parentId: null, isActive: true, slug: { notIn: activeParentSlugs } },
    data: { isActive: false },
  });
  if (deactivated.count > 0) {
    console.log(`  Deactivated ${deactivated.count} stale parent categories\n`);
  }

  // ── Demo Provider ──────────────────────────────────────────────────────────
  const provider = await prisma.user.upsert({
    where: { phone: DEMO_PHONES.provider },
    update: {
      profile: {
        update: {
          avgRating: 4.8, totalReviews: 42, completedJobs: 150,
          completionRate: 95, responseRate: 98, isProvider: true,
        },
      },
    },
    create: {
      phone: DEMO_PHONES.provider,
      isPhoneVerified: true,
      isActive: true,
      profile: {
        create: {
          firstName: 'Emeka',
          lastName: 'Okafor',
          displayName: 'Emeka Plumbing Pro',
          bio: 'Professional plumber with 8 years of experience in Lagos.',
          city: 'Lagos',
          state: 'Lagos',
          country: 'NG',
          isProvider: true,
          avgRating: 4.8,
          totalReviews: 42,
          completedJobs: 150,
          completionRate: 95,
          responseRate: 98,
          travelRadius: 15,
        },
      },
      notificationPrefs: { create: {} },
      verification: { create: { status: 'APPROVED', reviewedAt: new Date() } },
    },
  });

  await prisma.$executeRaw`
    UPDATE user_profiles
    SET location = ST_SetSRID(ST_MakePoint(3.3792, 6.5244), 4326)::geography
    WHERE "userId" = ${provider.id}
  `;

  const plumbingParent = await prisma.category.findUnique({ where: { slug: 'home-services' } });
  if (plumbingParent) {
    await prisma.serviceListing.upsert({
      where: { slug: 'professional-plumbing-services-lagos-emeka' },
      // Always sync categoryId so re-seeds don't leave stale references to old categories
      update: { categoryId: plumbingParent.id },
      create: {
        providerId:   provider.id,
        categoryId:   plumbingParent.id,
        title:        'Professional Plumbing Services Lagos',
        slug:         'professional-plumbing-services-lagos-emeka',
        description:  'Expert plumbing — pipe repairs, installation, bathroom fitting and emergency callouts. Available 7 days a week.',
        startingPrice: 5000,
        minPrice:     5000,
        maxPrice:     150000,
        serviceRadius: 15,
        status:       'APPROVED',
        isPublished:  true,
        reviewedAt:   new Date(),
        trendingScore:    85,
        engagementScore:  72,
        likesCount:   34,
        savesCount:   21,
        viewsCount:   420,
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
  }
  console.log(`✓ Provider: ${provider.phone} (Emeka Okafor)`);

  // ── Demo Customer ──────────────────────────────────────────────────────────
  const customer = await prisma.user.upsert({
    where: { phone: DEMO_PHONES.customer },
    update: {},
    create: {
      phone: DEMO_PHONES.customer,
      isPhoneVerified: true,
      isActive: true,
      profile: {
        create: {
          firstName: 'Adaeze',
          lastName:  'Nwosu',
          displayName: 'Adaeze N.',
          city:  'Lagos',
          state: 'Lagos',
          country: 'NG',
        },
      },
      notificationPrefs: { create: {} },
    },
  });
  console.log(`✓ Customer: ${customer.phone} (Adaeze Nwosu)`);

  console.log('\n' + '═'.repeat(52));
  console.log('  Seed complete');
  console.log('═'.repeat(52));
  console.log('  API:     POST /api/v1/auth/send-otp  →  verify-otp');
  console.log('  Dev OTP: printed to backend terminal (no SMS)');
  console.log('  Admin:    ' + DEMO_PHONES.admin);
  console.log('  Provider: ' + DEMO_PHONES.provider);
  console.log('  Customer: ' + DEMO_PHONES.customer);
  console.log('─'.repeat(52));
  console.log('  Admin dashboard login (POST /api/v1/auth/admin/login):');
  console.log(`    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('═'.repeat(52));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
