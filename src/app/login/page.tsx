'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isMagicLink, setIsMagicLink] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  
  // Create client lazily to avoid issues during build
  const getSupabase = () => createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const supabase = getSupabase()
      
      if (isMagicLink) {
        // Check allowlist first
        const { data: allowlistData, error: allowlistError } = await supabase
          .from('allowlist_emails')
          .select('email')
          .eq('email', email.toLowerCase())
          .maybeSingle()

        // Debug logging
        if (allowlistError) {
          console.error('Allowlist query error:', allowlistError)
          setMessage(`Error checking allowlist: ${allowlistError.message}`)
          setLoading(false)
          return
        }

        if (!allowlistData) {
          console.log('Email not found in allowlist:', email.toLowerCase())
          setMessage('Your email is not on the invite list. Please request access.')
          setLoading(false)
          return
        }

        console.log('Email found in allowlist:', allowlistData)

        const { error } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase(),
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error
        setMessage('Check your email for the magic link!')
      } else {
        // Check allowlist first for password login too
        const { data: allowlistData, error: allowlistError } = await supabase
          .from('allowlist_emails')
          .select('email')
          .eq('email', email.toLowerCase())
          .maybeSingle()

        if (allowlistError || !allowlistData) {
          setMessage('Your email is not on the invite list. Please request access.')
          setLoading(false)
          return
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        })

        if (error) throw error
        router.push('/library')
        router.refresh()
      }
    } catch (error: any) {
      setMessage(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Check allowlist first
      const supabase = getSupabase()
      const { data: allowlistData, error: allowlistError } = await supabase
        .from('allowlist_emails')
        .select('email')
        .eq('email', email.toLowerCase())
        .maybeSingle()

      // Debug logging
      if (allowlistError) {
        console.error('Allowlist query error:', allowlistError)
        setMessage(`Error checking allowlist: ${allowlistError.message}`)
        setLoading(false)
        return
      }

      if (!allowlistData) {
        console.log('Email not found in allowlist:', email.toLowerCase())
        setMessage('Your email is not on the invite list. Please request access.')
        setLoading(false)
        return
      }

      console.log('Email found in allowlist:', allowlistData)

      if (isMagicLink) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase(),
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error
        setMessage('Check your email for the magic link!')
      } else {
        if (!password || password.length < 6) {
          setMessage('Password must be at least 6 characters')
          setLoading(false)
          return
        }

        const { error } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error
        setMessage('Account created! Check your email to verify your account.')
      }
    } catch (error: any) {
      setMessage(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-12 bg-white">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="mb-6">
            <div className="mb-4 w-32 h-32 relative">
              <Image
                src="/logo.png"
                alt="Echo Pages Logo"
                fill
                sizes="128px"
                className="object-contain"
                priority
              />
            </div>
          </div>
          
          {/* Main Title */}
          <h2 className="text-3xl font-bold text-black mb-2">
            Your Personal Audiobook Library
          </h2>
          
          {/* Subtitle */}
          <p className="text-gray-600 mb-8">
            Welcome Back, Please login to your account
          </p>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.includes('error') || message.includes('not on') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSignIn}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-black mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500"
                placeholder="Enter your email"
              />
            </div>

            {/* Password Field */}
            {!isMagicLink && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required={!isMagicLink}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500"
                  placeholder="Enter your password"
                />
              </div>
            )}

            {/* Remember Me and Magic Link */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-lilac-500 focus:ring-lilac-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-black">
                  Remember me
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="magic-link"
                  name="magic-link"
                  type="checkbox"
                  checked={isMagicLink}
                  onChange={(e) => setIsMagicLink(e.target.checked)}
                  className="h-4 w-4 text-lilac-500 focus:ring-lilac-500 border-gray-300 rounded"
                />
                <label htmlFor="magic-link" className="ml-2 block text-sm text-black">
                  Use magic link
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3 mt-6">
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: '#8b5cf6', color: 'white' }}
                className="w-full py-3 px-6 rounded-lg font-medium hover:bg-lilac-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lilac-500 disabled:opacity-50 transition-colors shadow-md text-lg"
              >
                {loading ? 'Loading...' : 'Login'}
              </button>
              <div className="relative flex items-center my-2">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink mx-4 text-sm text-gray-500">or</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>
              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full py-3 px-6 bg-white border-2 border-lilac-500 text-lilac-600 rounded-lg font-medium hover:bg-lilac-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lilac-500 disabled:opacity-50 transition-colors"
              >
                Sign Up
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Side - Login Image */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden bg-pink-soft">
        <Image
          src="/Login screen right image.png"
          alt="Echo Pages Login"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  )
}
