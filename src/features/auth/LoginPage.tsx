import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Field, fieldA11y } from '@/components/shared/Field'
import { Brand } from '@/components/navigation/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { toUserMessage } from '@/lib/supabase/errors'
import { useAuth } from './AuthProvider'

const loginSchema = z.object({
  email: z.email('Introduce un correo válido.'),
  password: z.string().min(1, 'Introduce tu contraseña.'),
})
type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  if (session) return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      setFormError(toUserMessage(error, 'No se pudo iniciar sesión.'))
      return
    }
    navigate(from, { replace: true })
  })

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Brand className="mb-2" />
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Acceso exclusivo para la cuenta propietaria.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured && (
            <p role="alert" className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              Falta configurar VITE_SUPABASE_URL y la clave publicable en el archivo .env.local.
            </p>
          )}
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <Field id="email" label="Correo electrónico" error={formState.errors.email?.message}>
              <Input type="email" autoComplete="email" {...fieldA11y('email', formState.errors.email?.message)} {...register('email')} />
            </Field>
            <Field id="password" label="Contraseña" error={formState.errors.password?.message}>
              <Input type="password" autoComplete="current-password" {...fieldA11y('password', formState.errors.password?.message)} {...register('password')} />
            </Field>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={formState.isSubmitting}>
              <LogIn aria-hidden /> {formState.isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
