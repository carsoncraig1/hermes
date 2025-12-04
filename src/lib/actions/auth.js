'use server'

import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { signIn } from '@/lib/auth'

export async function register(data) {
  try {
    const { name, email, password } = data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return { error: 'User with this email already exists' }
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      }
    })

    return { success: true, userId: user.id }
  } catch (error) {
    console.error('Registration error:', error)
    return { error: 'Failed to create account' }
  }
}

export async function login(data) {
  try {
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    return { success: true }
  } catch (error) {
    console.error('Login error:', error)
    return { error: 'Invalid email or password' }
  }
}
