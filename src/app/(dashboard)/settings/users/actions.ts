'use server';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role_id = formData.get('role_id') ? Number(formData.get('role_id')) : null;
  const region_id = formData.get('region_id') ? Number(formData.get('region_id')) : null;
  const location_id = formData.get('location_id') ? Number(formData.get('location_id')) : null;

  if (!name || !email || !password || !role_id) {
    throw new Error('Name, Email, Password, and Role are required fields.');
  }

  const db = getDb();

  try {
    const password_hash = bcrypt.hashSync(password, 10);
    
    const roleRes = await db.query('SELECT name FROM roles WHERE id = $1', [role_id]);
    const roleRow = roleRes.rows[0];
    const legacyRoleString = roleRow ? roleRow.name.toUpperCase().replace(' ', '_') : 'VOLUNTEER';
    
    await db.query(`
      INSERT INTO users (name, email, password_hash, role, role_id, region_id, location_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [name, email, password_hash, legacyRoleString, role_id, region_id, location_id]);

    revalidatePath('/settings/users');
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create user');
  }
}

export async function deleteUser(id: number) {
  const db = getDb();
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    revalidatePath('/settings/users');
    return { success: true };
  } catch(error) {
    throw new Error('Failed to delete user');
  }
}

export async function updateUser(id: number, formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role_id = formData.get('role_id') ? Number(formData.get('role_id')) : null;
  const region_id = formData.get('region_id') ? Number(formData.get('region_id')) : null;
  const location_id = formData.get('location_id') ? Number(formData.get('location_id')) : null;

  if (!name || !email || !role_id) {
    throw new Error('Name, Email, and Role are required fields.');
  }

  const db = getDb();

  try {
    const roleRes = await db.query('SELECT name FROM roles WHERE id = $1', [role_id]);
    const roleRow = roleRes.rows[0];
    const legacyRoleString = roleRow ? roleRow.name.toUpperCase().replace(' ', '_') : 'VOLUNTEER';
    
    if (password) {
      const password_hash = bcrypt.hashSync(password, 10);
      await db.query(`
        UPDATE users 
        SET name = $1, email = $2, password_hash = $3, role = $4, role_id = $5, region_id = $6, location_id = $7
        WHERE id = $8
      `, [name, email, password_hash, legacyRoleString, role_id, region_id, location_id, id]);
    } else {
      await db.query(`
        UPDATE users 
        SET name = $1, email = $2, role = $3, role_id = $4, region_id = $5, location_id = $6
        WHERE id = $7
      `, [name, email, legacyRoleString, role_id, region_id, location_id, id]);
    }
    
    revalidatePath('/settings/users');
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update user');
  }
}
