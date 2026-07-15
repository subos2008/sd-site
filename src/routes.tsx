import { createBrowserRouter, type RouteObject } from 'react-router'
import {
  RequireAnonymous,
  RequireOnboarded,
  RequirePendingOnboarding,
  RequireRoleChosen,
  RootRedirect,
} from './lib/route-guards'
import { SignupPage } from './features/auth/pages/SignupPage'
import { LoginPage } from './features/auth/pages/LoginPage'
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage'
import { AuthConfirmPage } from './features/auth/pages/AuthConfirmPage'
import { OnboardingLayout } from './features/onboarding/pages/OnboardingLayout'
import { RoleStep } from './features/onboarding/components/RoleStep'
import { IdentityStep } from './features/onboarding/components/IdentityStep'
import { LocationStep } from './features/onboarding/components/LocationStep'
import { PhotoStep } from './features/onboarding/components/PhotoStep'
import { BioStep } from './features/onboarding/components/BioStep'
import { DetailsStep } from './features/onboarding/components/DetailsStep'
import { InterestsStep } from './features/onboarding/components/InterestsStep'
import { OnboardingCompletePage } from './features/onboarding/pages/OnboardingCompletePage'
import { AppShell } from './features/shell/AppShell'
import { SearchPage } from './features/search/pages/SearchPage'
import { ProfilePage } from './features/profile/pages/ProfilePage'
import { MyProfilePage } from './features/profile/pages/MyProfilePage'
import { LikesPage } from './features/likes/pages/LikesPage'

export const routeConfig: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },

  {
    element: <RequireAnonymous />,
    children: [
      { path: '/signup', element: <SignupPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },

  { path: '/auth/confirm', element: <AuthConfirmPage /> },

  {
    element: <RequirePendingOnboarding />,
    children: [
      {
        path: '/onboarding',
        element: <OnboardingLayout />,
        children: [
          { path: 'role', element: <RoleStep /> },
          {
            element: <RequireRoleChosen />,
            children: [
              { path: 'identity', element: <IdentityStep /> },
              { path: 'location', element: <LocationStep /> },
              { path: 'photo', element: <PhotoStep /> },
              { path: 'bio', element: <BioStep /> },
              { path: 'details', element: <DetailsStep /> },
              { path: 'interests', element: <InterestsStep /> },
              { path: 'complete', element: <OnboardingCompletePage /> },
            ],
          },
        ],
      },
    ],
  },

  {
    element: <RequireOnboarded />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/search', element: <SearchPage /> },
          { path: '/profile/:id', element: <ProfilePage /> },
          { path: '/me', element: <MyProfilePage /> },
          { path: '/messages', element: <div className="p-4">Messages — Plan 05</div> },
          { path: '/likes', element: <LikesPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routeConfig)
