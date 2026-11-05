import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import Category from '../models/Category.js';

import { generateBusinessId } from '../utils/generateId.js';
import { slugify } from '../utils/slugify.js';

const defaultCategories = [
  {
    name: 'Kurtis',
    image: 'https://images.unsplash.com/photo-1583391733958-6c78276477e3?auto=format&fit=crop&w=800&q=85'
  },
  {
    name: 'Sarees',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=85'
  },
  {
    name: 'Dresses',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=85'
  },
  {
    name: 'Ethnic Wear',
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=85'
  },
  {
    name: 'Tops',
    image: 'https://images.unsplash.com/photo-1551163943-3f6a855d1153?auto=format&fit=crop&w=800&q=85'
  },
  {
    name: 'Dupattas',
    image: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=800&q=85'
  }
];

async function seedCategories() {
  await connectDB();

  for (let index = 0; index < defaultCategories.length; index++) {
    const item = defaultCategories[index];

    const slug = slugify(item.name);

    const existing = await Category.findOne({
      slug
    });

    if (existing) {
      console.log(`Already exists: ${item.name}`);
      continue;
    }

    await Category.create({
      categoryId: generateBusinessId('CAT'),
      name: item.name,
      slug,
      image: item.image,
      description: `${item.name} collection`,
      displayOrder: index + 1,
      status: 'active'
    });

    console.log(`Created category: ${item.name}`);
  }

  console.log('Category seeding completed.');
}

seedCategories()
  .catch(error => {
    console.error('Category seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });