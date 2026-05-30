import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router'
import { useSearchFilters, type ParsedFilters } from '../hooks'

type SetFilters = (next: ParsedFilters) => void

function Probe() {
  const [filters] = useSearchFilters()
  return (
    <div>
      <span data-testid="min">{filters.min_age ?? ''}</span>
      <span data-testid="max">{filters.max_age ?? ''}</span>
      <span data-testid="dist">{filters.distance_miles ?? ''}</span>
      <span data-testid="ints">{(filters.interest_ids ?? []).join(',')}</span>
    </div>
  )
}

describe('useSearchFilters', () => {
  it('parses min_age, max_age, distance_miles, interest_ids from URL', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/search?min_age=22&max_age=35&distance_miles=25&interest_ids=11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222',
        ]}
      >
        <Probe />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('min')).toHaveTextContent('22')
    expect(screen.getByTestId('max')).toHaveTextContent('35')
    expect(screen.getByTestId('dist')).toHaveTextContent('25')
    expect(screen.getByTestId('ints')).toHaveTextContent(
      '11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222',
    )
  })

  it('writes filters back to URL via setSearchParams', () => {
    const capture: { set?: SetFilters } = {}
    function Inner() {
      const [, set] = useSearchFilters()
      useEffect(() => {
        capture.set = set
      }, [set])
      return null
    }
    function Spy() {
      const [params] = useSearchParams()
      return <span data-testid="url">{params.toString()}</span>
    }
    render(
      <MemoryRouter initialEntries={['/search']}>
        <Inner />
        <Spy />
      </MemoryRouter>,
    )
    act(() => capture.set!({ min_age: 22, distance_miles: 30 }))
    const url = screen.getByTestId('url').textContent ?? ''
    expect(url).toContain('min_age=22')
    expect(url).toContain('distance_miles=30')
  })
})
