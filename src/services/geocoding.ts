// Servicio de geocodificación usando OpenRouteService
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || ''

export interface GeocodingResult {
  lat: number
  lon: number
  displayName: string
  confidence: number
}

export async function geocodeAddress(address: string): Promise<GeocodingResult[]> {
  if (!address.trim()) {
    return []
  }

  try {
    // Try OpenRouteService first
    if (ORS_API_KEY) {
      const response = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}&size=5`,
        {
          headers: {
            'Accept': 'application/json, application/geo+json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        
        if (data.features && data.features.length > 0) {
          return data.features.map((feature: any) => ({
            lat: feature.geometry.coordinates[1],
            lon: feature.geometry.coordinates[0],
            displayName: feature.properties.label || feature.properties.name,
            confidence: feature.properties.confidence || 0.5
          }))
        }
      }
    }

    // Fallback to Nominatim (OpenStreetMap)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5`,
      {
        headers: {
          'Accept-Language': 'es-AR'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Geocoding service unavailable')
    }

    const data = await response.json()
    
    return data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      displayName: item.display_name,
      confidence: parseFloat(item.importance) || 0.5
    }))

  } catch (error) {
    console.error('Geocoding error:', error)
    throw new Error('Error al buscar la dirección. Intenta de nuevo.')
  }
}

// Hook para geocodificación con debounce
export function useGeocoding() {
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchAddress = (address: string, delay = 500) => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (!address.trim()) {
      setResults([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    timeoutRef.current = setTimeout(async () => {
      try {
        const geocodingResults = await geocodeAddress(address)
        setResults(geocodingResults)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error de búsqueda')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, delay)
  }

  const clearResults = () => {
    setResults([])
    setError(null)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  return { results, loading, error, searchAddress, clearResults }
}

import { useState, useRef } from 'react'
