import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '@/shared/components/ui/Card/Card';
import CardContent from '@/shared/components/ui/Card/CardContent';
import CardHeader from '@/shared/components/ui/Card/CardHeader';
import Button from '@/shared/components/ui/Button/Button';
import Input from '@/shared/components/ui/Input/Input';
import { toast } from 'react-hot-toast';

function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1">
      {children}
    </label>
  );
}

function CardDescription({ children }) {
  return <p className="text-sm text-gray-600">{children}</p>;
}

function CardTitle({ children }) {
  return <h3 className="text-lg font-semibold">{children}</h3>;
}
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import api from '@/app/services/api';

const STEPS = [
  { id: 1, name: 'Group Information', icon: '🏛️' },
  { id: 2, name: 'Membership Model', icon: '👥' },
  { id: 3, name: 'Membership Classes', icon: '👤' },
  { id: 4, name: 'Contributions', icon: '💰' },
  { id: 5, name: 'Beneficiaries', icon: '👨‍👩‍👧‍👦' },
  { id: 6, name: 'Waiting Period', icon: '⏳' },
  { id: 7, name: 'Benefits', icon: '🎁' },
  { id: 8, name: 'Approvals', icon: '✅' },
  { id: 9, name: 'Payments', icon: '💳' },
  { id: 10, name: 'Communication', icon: '📱' },
];

export default function BurialChamaSetupPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // Fetch wizard template
  const { data: template } = useQuery({
    queryKey: ['burial-chama-wizard-template'],
    queryFn: async () => {
      const response = await api.get('/api/v1/burial-chama/wizard/template');
      return response.data.data;
    }
  });

  // Fetch preset configurations
  const { data: presets } = useQuery({
    queryKey: ['burial-chama-presets'],
    queryFn: async () => {
      const response = await api.get('/api/v1/burial-chama/wizard/presets');
      return response.data.data;
    }
  });

  // Complete wizard mutation
  const completeWizardMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(
        `/api/v1/burial-chama/chama/${workspaceId}/wizard/complete`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Burial chama setup completed successfully!');
      queryClient.invalidateQueries(['burial-chama-profile']);
      navigate(`/workspace/${workspaceId}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to complete setup');
    }
  });

  const handleNext = async () => {
    // Validate current step
    try {
      const response = await api.post(
        `/api/v1/burial-chama/wizard/validate/${currentStep}`,
        wizardData[`step_${currentStep}`] || {}
      );
      
      if (!response.data.data.valid) {
        toast.error('Please fix the errors before proceeding');
        return;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Validation failed');
      return;
    }

    if (currentStep < 10) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeWizardMutation.mutateAsync(wizardData);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (presetKey) => {
    const preset = presets[presetKey];
    if (preset) {
      setWizardData({
        step_1: {
          name: preset.name,
          // ... other group info
        },
        step_2: {
          membership_model: preset.config.membership_model
        },
        step_3: {
          membership_classes: preset.config.membership_classes
        },
        step_4: {
          contribution_components: preset.config.contribution_components
        },
        step_5: {
          beneficiary_categories: preset.config.beneficiary_categories
        },
        step_6: {
          waiting_period_days: preset.config.waiting_period_days
        },
        step_7: {
          benefit_rules: preset.config.benefit_rules
        }
      });
      setSelectedPreset(presetKey);
      toast.success(`Applied ${preset.name} preset`);
    }
  };

  const updateStepData = (stepId, data) => {
    setWizardData(prev => ({
      ...prev,
      [`step_${stepId}`]: {
        ...prev[`step_${stepId}`],
        ...data
      }
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <GroupInformationStep data={wizardData.step_1} onChange={(data) => updateStepData(1, data)} />;
      case 2:
        return <MembershipModelStep data={wizardData.step_2} onChange={(data) => updateStepData(2, data)} />;
      case 3:
        return <MembershipClassesStep data={wizardData.step_3} onChange={(data) => updateStepData(3, data)} />;
      case 4:
        return <ContributionsStep data={wizardData.step_4} onChange={(data) => updateStepData(4, data)} />;
      case 5:
        return <BeneficiariesStep data={wizardData.step_5} onChange={(data) => updateStepData(5, data)} />;
      case 6:
        return <WaitingPeriodStep data={wizardData.step_6} onChange={(data) => updateStepData(6, data)} />;
      case 7:
        return <BenefitsStep data={wizardData.step_7} onChange={(data) => updateStepData(7, data)} />;
      case 8:
        return <ApprovalsStep data={wizardData.step_8} onChange={(data) => updateStepData(8, data)} />;
      case 9:
        return <PaymentsStep data={wizardData.step_9} onChange={(data) => updateStepData(9, data)} />;
      case 10:
        return <CommunicationStep data={wizardData.step_10} onChange={(data) => updateStepData(10, data)} />;
      default:
        return null;
    }
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Burial Chama Setup</h1>
        <p className="text-gray-600">Configure your burial chama with our step-by-step wizard</p>
      </div>

      {/* Preset Selection */}
      {presets && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Start Templates</CardTitle>
            <CardDescription>Choose a preset configuration to get started quickly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(presets).map(([key, preset]) => (
                <div
                  key={key}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedPreset === key ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                  }`}
                  onClick={() => handlePresetSelect(key)}
                >
                  <h3 className="font-semibold mb-1">{preset.name}</h3>
                  <p className="text-sm text-gray-600">{preset.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Step {currentStep} of {STEPS.length}</span>
          <span className="text-sm text-gray-500">{Math.round((currentStep / STEPS.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all" 
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {STEPS.map((step) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              currentStep === step.id
                ? 'bg-blue-500 text-white'
                : currentStep > step.id
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{step.icon}</span>
            <span className="text-sm font-medium">{step.name}</span>
            {currentStep > step.id && <Check className="w-4 h-4" />}
          </button>
        ))}
      </div>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].name}</CardTitle>
          <CardDescription>{template.steps[currentStep - 1]?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button
          variant="secondary"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {currentStep === 10 ? (
          <Button
            onClick={handleComplete}
            disabled={loading || completeWizardMutation.isPending}
          >
            {loading || completeWizardMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Completing Setup...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Complete Setup
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Step Components
function GroupInformationStep({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Chama Name</Label>
        <Input
          id="name"
          value={data?.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Enter your chama name"
        />
      </div>
      <div>
        <Label htmlFor="registration_number">Registration Number</Label>
        <Input
          id="registration_number"
          value={data?.registration_number || ''}
          onChange={(e) => onChange({ registration_number: e.target.value })}
          placeholder="e.g., BN/2023/12345"
        />
      </div>
      <div>
        <Label htmlFor="physical_address">Physical Address</Label>
        <Input
          id="physical_address"
          value={data?.physical_address || ''}
          onChange={(e) => onChange({ physical_address: e.target.value })}
          placeholder="Enter physical address"
        />
      </div>
      <div>
        <Label htmlFor="county">County</Label>
        <Input
          id="county"
          value={data?.county || ''}
          onChange={(e) => onChange({ county: e.target.value })}
          placeholder="Enter county"
        />
      </div>
      <div>
        <Label htmlFor="contact_phone">Contact Phone</Label>
        <Input
          id="contact_phone"
          value={data?.contact_phone || ''}
          onChange={(e) => onChange({ contact_phone: e.target.value })}
          placeholder="e.g., 0712345678"
        />
      </div>
    </div>
  );
}

function MembershipModelStep({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Membership Model</Label>
        <select
          value={data?.membership_model || ''}
          onChange={(e) => onChange({ membership_model: e.target.value })}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">Select membership model</option>
          <option value="individual">Individual (per person)</option>
          <option value="household">Household (per family)</option>
          <option value="hybrid">Hybrid (both)</option>
        </select>
      </div>
      <p className="text-sm text-gray-600">
        Individual: Each member contributes separately. Household: Families contribute as a unit.
      </p>
    </div>
  );
}

function MembershipClassesStep({ data, onChange }) {
  const [classes, setClasses] = useState(data?.membership_classes || [
    { name: 'ordinary', contribution_amount: 200, frequency: 'monthly' }
  ]);

  const addClass = () => {
    setClasses([...classes, { name: '', contribution_amount: 0, frequency: 'monthly' }]);
  };

  const updateClass = (index, field, value) => {
    const updated = [...classes];
    updated[index] = { ...updated[index], [field]: value };
    setClasses(updated);
    onChange({ membership_classes: updated });
  };

  const removeClass = (index) => {
    const updated = classes.filter((_, i) => i !== index);
    setClasses(updated);
    onChange({ membership_classes: updated });
  };

  return (
    <div className="space-y-4">
      {classes.map((cls, index) => (
        <div key={index} className="p-4 border rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Class {index + 1}</h4>
            {classes.length > 1 && (
              <Button variant="danger" size="sm" onClick={() => removeClass(index)}>
                Remove
              </Button>
            )}
          </div>
          <div>
            <Label>Class Name</Label>
            <Input
              value={cls.name}
              onChange={(e) => updateClass(index, 'name', e.target.value)}
              placeholder="e.g., ordinary, senior"
            />
          </div>
          <div>
            <Label>Contribution Amount (KES)</Label>
            <Input
              type="number"
              value={cls.contribution_amount}
              onChange={(e) => updateClass(index, 'contribution_amount', parseFloat(e.target.value))}
              placeholder="200"
            />
          </div>
          <div>
            <Label>Frequency</Label>
            <select
              value={cls.frequency}
              onChange={(e) => updateClass(index, 'frequency', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
        </div>
      ))}
      <Button onClick={addClass} variant="outline">
        Add Membership Class
      </Button>
    </div>
  );
}

function ContributionsStep({ data, onChange }) {
  const [components, setComponents] = useState(data?.contribution_components || [
    { name: 'Welfare', amount: 200, frequency: 'monthly' }
  ]);

  const addComponent = () => {
    setComponents([...components, { name: '', amount: 0, frequency: 'monthly' }]);
  };

  const updateComponent = (index, field, value) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
    onChange({ contribution_components: updated });
  };

  const removeComponent = (index) => {
    const updated = components.filter((_, i) => i !== index);
    setComponents(updated);
    onChange({ contribution_components: updated });
  };

  return (
    <div className="space-y-4">
      {components.map((component, index) => (
        <div key={index} className="p-4 border rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Component {index + 1}</h4>
            {components.length > 1 && (
              <Button variant="danger" size="sm" onClick={() => removeComponent(index)}>
                Remove
              </Button>
            )}
          </div>
          <div>
            <Label>Component Name</Label>
            <Input
              value={component.name}
              onChange={(e) => updateComponent(index, 'name', e.target.value)}
              placeholder="e.g., Welfare, Emergency"
            />
          </div>
          <div>
            <Label>Amount (KES)</Label>
            <Input
              type="number"
              value={component.amount}
              onChange={(e) => updateComponent(index, 'amount', parseFloat(e.target.value))}
              placeholder="200"
            />
          </div>
          <div>
            <Label>Frequency</Label>
            <select
              value={component.frequency}
              onChange={(e) => updateComponent(index, 'frequency', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
        </div>
      ))}
      <Button onClick={addComponent} variant="outline">
        Add Contribution Component
      </Button>
    </div>
  );
}

function BeneficiariesStep({ data, onChange }) {
  const [categories, setCategories] = useState(data?.beneficiary_categories || [
    { relationship: 'self' },
    { relationship: 'spouse' },
    { relationship: 'child', max_age: 25 }
  ]);

  const addCategory = () => {
    setCategories([...categories, { relationship: '', max_age: null }]);
  };

  const updateCategory = (index, field, value) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], [field]: value };
    setCategories(updated);
    onChange({ beneficiary_categories: updated });
  };

  const removeCategory = (index) => {
    const updated = categories.filter((_, i) => i !== index);
    setCategories(updated);
    onChange({ beneficiary_categories: updated });
  };

  return (
    <div className="space-y-4">
      {categories.map((category, index) => (
        <div key={index} className="p-4 border rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Beneficiary {index + 1}</h4>
            {categories.length > 1 && (
              <Button variant="danger" size="sm" onClick={() => removeCategory(index)}>
                Remove
              </Button>
            )}
          </div>
          <div>
            <Label>Relationship</Label>
            <select
              value={category.relationship}
              onChange={(e) => updateCategory(index, 'relationship', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="self">Self</option>
              <option value="spouse">Spouse</option>
              <option value="child">Child</option>
              <option value="parent">Parent</option>
              <option value="sibling">Sibling</option>
              <option value="dependant">Dependant</option>
            </select>
          </div>
          <div>
            <Label>Maximum Age (if applicable)</Label>
            <Input
              type="number"
              value={category.max_age || ''}
              onChange={(e) => updateCategory(index, 'max_age', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g., 25 for children"
            />
          </div>
        </div>
      ))}
      <Button onClick={addCategory} variant="outline">
        Add Beneficiary Category
      </Button>
    </div>
  );
}

function WaitingPeriodStep({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="waiting_period_days">Waiting Period (days)</Label>
        <Input
          id="waiting_period_days"
          type="number"
          value={data?.waiting_period_days || 90}
          onChange={(e) => onChange({ waiting_period_days: parseInt(e.target.value) })}
          placeholder="90"
        />
        <p className="text-sm text-gray-600 mt-1">
          New members must wait this many days before becoming eligible for benefits
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="partial_coverage"
          checked={data?.partial_coverage_during_waiting || false}
          onCheckedChange={(checked) => onChange({ partial_coverage_during_waiting: checked })}
        />
        <Label htmlFor="partial_coverage">Allow partial coverage during waiting period</Label>
      </div>
    </div>
  );
}

function BenefitsStep({ data, onChange }) {
  const [rules, setRules] = useState(data?.benefit_rules || [
    { relationship: 'self', calculation_method: 'fixed_amount', fixed_amount: 50000 }
  ]);

  const addRule = () => {
    setRules([...rules, { relationship: '', calculation_method: 'fixed_amount', fixed_amount: 0 }]);
  };

  const updateRule = (index, field, value) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
    onChange({ benefit_rules: updated });
  };

  const removeRule = (index) => {
    const updated = rules.filter((_, i) => i !== index);
    setRules(updated);
    onChange({ benefit_rules: updated });
  };

  return (
    <div className="space-y-4">
      {rules.map((rule, index) => (
        <div key={index} className="p-4 border rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Benefit Rule {index + 1}</h4>
            {rules.length > 1 && (
              <Button variant="danger" size="sm" onClick={() => removeRule(index)}>
                Remove
              </Button>
            )}
          </div>
          <div>
            <Label>Relationship</Label>
            <select
              value={rule.relationship}
              onChange={(e) => updateRule(index, 'relationship', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="self">Self</option>
              <option value="spouse">Spouse</option>
              <option value="child">Child</option>
              <option value="parent">Parent</option>
            </select>
          </div>
          <div>
            <Label>Calculation Method</Label>
            <select
              value={rule.calculation_method}
              onChange={(e) => updateRule(index, 'calculation_method', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="fixed_amount">Fixed Amount</option>
              <option value="contribution_multiple">Contribution Multiple</option>
              <option value="percentage">Percentage</option>
            </select>
          </div>
          {rule.calculation_method === 'fixed_amount' && (
            <div>
              <Label>Fixed Amount (KES)</Label>
              <Input
                type="number"
                value={rule.fixed_amount || ''}
                onChange={(e) => updateRule(index, 'fixed_amount', parseFloat(e.target.value))}
                placeholder="50000"
              />
            </div>
          )}
        </div>
      ))}
      <Button onClick={addRule} variant="outline">
        Add Benefit Rule
      </Button>
    </div>
  );
}

function ApprovalsStep({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Claim Approval</Label>
        <div className="space-y-2 mt-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="chairperson"
              checked={data?.claim_approval?.required_roles?.includes('chairperson') || false}
              onChange={(e) => {
                const roles = data?.claim_approval?.required_roles || [];
                const updated = e.target.checked 
                  ? [...roles, 'chairperson']
                  : roles.filter(r => r !== 'chairperson');
                onChange({ 
                  claim_approval: { 
                    ...data?.claim_approval, 
                    required_roles: updated 
                  } 
                });
              }}
            />
            <Label htmlFor="chairperson">Chairperson</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="treasurer"
              checked={data?.claim_approval?.required_roles?.includes('treasurer') || false}
              onChange={(e) => {
                const roles = data?.claim_approval?.required_roles || [];
                const updated = e.target.checked 
                  ? [...roles, 'treasurer']
                  : roles.filter(r => r !== 'treasurer');
                onChange({ 
                  claim_approval: { 
                    ...data?.claim_approval, 
                    required_roles: updated 
                  } 
                });
              }}
            />
            <Label htmlFor="treasurer">Treasurer</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="secretary"
              checked={data?.claim_approval?.required_roles?.includes('secretary') || false}
              onChange={(e) => {
                const roles = data?.claim_approval?.required_roles || [];
                const updated = e.target.checked 
                  ? [...roles, 'secretary']
                  : roles.filter(r => r !== 'secretary');
                onChange({ 
                  claim_approval: { 
                    ...data?.claim_approval, 
                    required_roles: updated 
                  } 
                });
              }}
            />
            <Label htmlFor="secretary">Secretary</Label>
          </div>
        </div>
      </div>
      <div>
        <Label htmlFor="minimum_approvals">Minimum Approvals Required</Label>
        <Input
          id="minimum_approvals"
          type="number"
          value={data?.claim_approval?.minimum_approvals || 2}
          onChange={(e) => onChange({ 
            claim_approval: { 
              ...data?.claim_approval, 
              minimum_approvals: parseInt(e.target.value) 
            } 
          })}
          min="1"
        />
      </div>
    </div>
  );
}

function PaymentsStep({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Accepted Payment Methods</Label>
        <div className="space-y-2 mt-2">
          {['mpesa', 'bank', 'cash'].map((method) => (
            <div key={method} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={method}
                checked={data?.payment_methods?.includes(method) || false}
                onChange={(e) => {
                  const methods = data?.payment_methods || [];
                  const updated = e.target.checked 
                    ? [...methods, method]
                    : methods.filter(m => m !== method);
                  onChange({ payment_methods: updated });
                }}
              />
              <Label htmlFor={method} className="capitalize">{method}</Label>
            </div>
          ))}
        </div>
      </div>
      {data?.payment_methods?.includes('mpesa') && (
        <div>
          <Label htmlFor="paybill_number">M-Pesa PayBill Number</Label>
          <Input
            id="paybill_number"
            value={data?.mpesa_config?.paybill_number || ''}
            onChange={(e) => onChange({ 
              mpesa_config: { 
                ...data?.mpesa_config, 
                paybill_number: e.target.value 
              } 
            })}
            placeholder="e.g., 123456"
          />
        </div>
      )}
    </div>
  );
}

function CommunicationStep({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Primary Communication Channel</Label>
        <select
          value={data?.primary_channel || 'sms'}
          onChange={(e) => onChange({ primary_channel: e.target.value })}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="app">App</option>
        </select>
      </div>
      <div>
        <Label>Enabled Channels</Label>
        <div className="space-y-2 mt-2">
          {['sms', 'whatsapp', 'app', 'email'].map((channel) => (
            <div key={channel} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={channel}
                checked={data?.enabled_channels?.includes(channel) || false}
                onChange={(e) => {
                  const channels = data?.enabled_channels || [];
                  const updated = e.target.checked 
                    ? [...channels, channel]
                    : channels.filter(c => c !== channel);
                  onChange({ enabled_channels: updated });
                }}
              />
              <Label htmlFor={channel} className="capitalize">{channel}</Label>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Default Language</Label>
        <select
          value={data?.default_language || 'sw'}
          onChange={(e) => onChange({ default_language: e.target.value })}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="en">English</option>
          <option value="sw">Swahili</option>
        </select>
      </div>
    </div>
  );
}