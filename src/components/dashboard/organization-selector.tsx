'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  email: string;
  fullName?: string;
  organizationId: string;
  role: string;
}

interface OrganizationSelectorProps {
  user: User;
}

// Mock organizations data - in real implementation, this would come from the database
const mockOrganizations = [
  {
    id: 'org-1',
    name: 'Acme Store',
    slug: 'acme-store',
    role: 'owner',
    isActive: true,
  },
  {
    id: 'org-2',
    name: 'Fashion Hub',
    slug: 'fashion-hub',
    role: 'admin',
    isActive: false,
  },
  {
    id: 'org-3',
    name: 'Tech Gadgets',
    slug: 'tech-gadgets',
    role: 'member',
    isActive: false,
  },
];

export function OrganizationSelector({ user }: OrganizationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(
    mockOrganizations.find(org => org.id === user.organizationId) || mockOrganizations[0]
  );

  const handleSelectOrganization = (org: typeof mockOrganizations[0]) => {
    setSelectedOrg(org);
    setOpen(false);
    // In real implementation, this would switch the user's active organization
    // and potentially redirect or refresh the page
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'member':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto p-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary shrink-0">
              <Building className="h-3 w-3" />
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate">
                {selectedOrg.name}
              </span>
              <div className="flex items-center gap-1">
                <Badge 
                  variant={getRoleBadgeVariant(selectedOrg.role)} 
                  className="text-xs h-4 px-1"
                >
                  {selectedOrg.role}
                </Badge>
              </div>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandList>
            <CommandEmpty>No organizations found.</CommandEmpty>
            <CommandGroup heading="Your Organizations">
              {mockOrganizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => handleSelectOrganization(org)}
                  className="flex items-center gap-2 p-2"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary">
                    <Building className="h-3 w-3" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {org.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge 
                        variant={getRoleBadgeVariant(org.role)} 
                        className="text-xs h-4 px-1"
                      >
                        {org.role}
                      </Badge>
                    </div>
                  </div>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      selectedOrg.id === org.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem className="flex items-center gap-2 p-2">
                <div className="flex h-6 w-6 items-center justify-center rounded border border-dashed">
                  <Plus className="h-3 w-3" />
                </div>
                <span className="text-sm">Create Organization</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}