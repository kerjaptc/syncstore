'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

interface LocationSelectorProps {
  value?: string;
  onValueChange?: (locationId: string | undefined) => void;
  onCreateLocation?: () => void;
  placeholder?: string;
  showAllOption?: boolean;
}

export function LocationSelector({
  value,
  onValueChange,
  onCreateLocation,
  placeholder = "Select location",
  showAllOption = true,
}: LocationSelectorProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const selectedLocation = locations.find(loc => loc.id === value);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value || (showAllOption ? 'all' : '')}
        onValueChange={(val) => onValueChange?.(val === 'all' ? undefined : val)}
        disabled={loading}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder={loading ? "Loading..." : placeholder}>
            {value && selectedLocation ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{selectedLocation.name}</span>
                {selectedLocation.isDefault && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
              </div>
            ) : showAllOption && (!value || value === 'all') ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>All Locations</span>
              </div>
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>All Locations</span>
              </div>
            </SelectItem>
          )}
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>{location.name}</span>
                    {location.isDefault && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  {location.address?.city && (
                    <div className="text-xs text-muted-foreground">
                      {[location.address.city, location.address.state, location.address.country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {onCreateLocation && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateLocation}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      )}
    </div>
  );
}