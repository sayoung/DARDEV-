import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs.js'

describe('Tabs', () => {
  it('cliquer sur un déclencheur affiche le contenu correspondant', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Onglet 1</TabsTrigger>
          <TabsTrigger value="tab2">Onglet 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Contenu 1</TabsContent>
        <TabsContent value="tab2">Contenu 2</TabsContent>
      </Tabs>
    )

    const tab1Trigger = screen.getByText('Onglet 1')
    const tab2Trigger = screen.getByText('Onglet 2')

    expect(tab1Trigger.getAttribute('data-state')).toBe('active')
    expect(tab2Trigger.getAttribute('data-state')).toBe('inactive')
    
    fireEvent.mouseDown(tab2Trigger)
    fireEvent.click(tab2Trigger)

    expect(tab1Trigger.getAttribute('data-state')).toBe('inactive')
    expect(tab2Trigger.getAttribute('data-state')).toBe('active')
  })
})
