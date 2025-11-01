'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'textarea';
  required: boolean;
  placeholder?: string;
}

interface ApiConfig {
  key: string;
  name: string;
  description: string;
  icon: string;
  fields: ConfigField[];
}

interface Setting {
  key: string;
  value: string;
  isSensitive: boolean;
  description?: string;
  lastTested?: string;
  testStatus: 'untested' | 'success' | 'failed';
  testError?: string;
}

interface ApiKeyConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configs: ApiConfig[];
  editingSetting?: Setting | null;
  onSaved: () => void;
}

export function ApiKeyConfigDialog({
  open,
  onOpenChange,
  configs,
  editingSetting,
  onSaved,
}: ApiKeyConfigDialogProps) {
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [loading, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      if (editingSetting) {
        // Editing existing setting
        setSelectedConfig(editingSetting.key);
        setDescription(editingSetting.description || '');
        
        // Parse existing value if it's JSON
        try {
          const parsed = JSON.parse(editingSetting.value);
          setFormData(parsed);
        } catch {
          // If not JSON, treat as simple value
          setFormData({ value: editingSetting.value });
        }
      } else {
        // Creating new setting
        resetForm();
      }
      setError(null);
      setSuccess(null);
    }
  }, [open, editingSetting]);

  const resetForm = () => {
    setSelectedConfig('');
    setFormData({});
    setDescription('');
    setShowPasswords({});
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const validateForm = (): string | null => {
    if (!selectedConfig) {
      return 'Please select a configuration type';
    }

    const config = configs.find(c => c.key === selectedConfig);
    if (!config) {
      return 'Invalid configuration selected';
    }

    // Check required fields
    for (const field of config.fields) {
      if (field.required && !formData[field.name]?.trim()) {
        return `${field.label} is required`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare the value to save
      const config = configs.find(c => c.key === selectedConfig)!;
      const valueToSave = config.fields.length === 1 && config.fields[0].name === 'value'
        ? formData.value // Simple string value
        : JSON.stringify(formData); // Complex object

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: selectedConfig,
          value: valueToSave,
          isSensitive: true,
          description: description.trim() || config.description,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to save configuration');
      }

      setSuccess('Configuration saved successfully!');
      setTimeout(() => {
        onSaved();
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const selectedConfigData = configs.find(c => c.key === selectedConfig);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editingSetting ? 'Edit Configuration' : 'Add API Configuration'}
          </DialogTitle>
          <DialogDescription>
            {editingSetting 
              ? 'Update your API credentials and settings'
              : 'Configure your marketplace or service integration'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {!editingSetting && (
            <div className="space-y-2">
              <Label htmlFor="config-type">Configuration Type</Label>
              <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service to configure" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((config) => (
                    <SelectItem key={config.key} value={config.key}>
                      <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span>{config.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedConfigData && (
            <>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder={`Configuration for ${selectedConfigData.name}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">API Credentials</h4>
                {selectedConfigData.fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        id={field.name}
                        type={field.type === 'password' && !showPasswords[field.name] ? 'password' : 'text'}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        className={field.type === 'password' ? 'pr-10' : ''}
                      />
                      {field.type === 'password' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => togglePasswordVisibility(field.name)}
                        >
                          {showPasswords[field.name] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your credentials will be encrypted and stored securely. Only users with admin access can view or modify these settings.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !selectedConfig}
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}