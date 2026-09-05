import { useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '@/app/services/api';

const STATUS_CONFIG = {
  reported: { icon: Clock, color: 'bg-yellow-100 text-yellow-700', label: 'Reported' },
  under_review: { icon: AlertCircle, color: 'bg-blue-100 text-blue-700', label: 'Under Review' },
  verified: { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'Verified' },
  approved: { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'Approved' },
  rejected: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Rejected' },
  closed: { icon: CheckCircle, color: 'bg-gray-100 text-gray-700', label: 'Closed' }
};

export default function BurialCasesPage() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    case_type: 'member_death',
    deceased_first_name: '',
    deceased_last_name: '',
    relationship_to_member: 'self',
    date_of_death: '',
    claimant_name: '',
    claimant_phone: '',
    claimant_relationship: 'spouse'
  });

  // Fetch burial cases
  const { data: cases, isLoading } = useQuery({
    queryKey: ['burial-cases', workspaceId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/burial-chama/chama/${workspaceId}/cases`);
      return response.data.data;
    }
  });

  // Create case mutation
  const createCaseMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/api/v1/burial-chama/cases', {
        ...data,
        burial_chama_profile_id: workspaceId
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Burial case reported successfully');
      setIsAddFormOpen(false);
      setFormData({
        case_type: 'member_death',
        deceased_first_name: '',
        deceased_last_name: '',
        relationship_to_member: 'self',
        date_of_death: '',
        claimant_name: '',
        claimant_phone: '',
        claimant_relationship: 'spouse'
      });
      queryClient.invalidateQueries(['burial-cases']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to report case');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createCaseMutation.mutate({
      deceased: {
        first_name: formData.deceased_first_name,
        last_name: formData.deceased_last_name,
        relationship_to_member: formData.relationship_to_member,
        date_of_death: formData.date_of_death
      },
      claimant: {
        name: formData.claimant_name,
        phone: formData.claimant_phone,
        relationship: formData.claimant_relationship
      }
    });
  };

  const getStatusIcon = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.reported;
    const Icon = config.icon;
    return <Icon className="w-4 h-4" />;
  };

  const getStatusColor = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.reported;
    return config.color;
  };

  const getStatusLabel = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.reported;
    return config.label;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Burial Cases</h1>
          <p className="text-gray-600">Manage burial and welfare cases</p>
        </div>
        <Button onClick={() => setIsAddFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Report Case
        </Button>
      </div>

      {isAddFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Report Burial Case</CardTitle>
            <CardDescription>
              Report a new burial or welfare case for benefit processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="case_type">Case Type</Label>
                <select
                  id="case_type"
                  value={formData.case_type}
                  onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="member_death">Member Death</option>
                  <option value="spouse_death">Spouse Death</option>
                  <option value="child_death">Child Death</option>
                  <option value="parent_death">Parent Death</option>
                  <option value="dependant_death">Dependant Death</option>
                  <option value="emergency_welfare">Emergency Welfare</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deceased_first_name">Deceased First Name</Label>
                  <Input
                    id="deceased_first_name"
                    value={formData.deceased_first_name}
                    onChange={(e) => setFormData({ ...formData, deceased_first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="deceased_last_name">Deceased Last Name</Label>
                  <Input
                    id="deceased_last_name"
                    value={formData.deceased_last_name}
                    onChange={(e) => setFormData({ ...formData, deceased_last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="relationship_to_member">Relationship to Member</Label>
                <select
                  id="relationship_to_member"
                  value={formData.relationship_to_member}
                  onChange={(e) => setFormData({ ...formData, relationship_to_member: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="self">Self</option>
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="dependant">Dependant</option>
                </select>
              </div>
              <div>
                <Label htmlFor="date_of_death">Date of Death</Label>
                <Input
                  id="date_of_death"
                  type="date"
                  value={formData.date_of_death}
                  onChange={(e) => setFormData({ ...formData, date_of_death: e.target.value })}
                  required
                />
              </div>
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Claimant Information</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="claimant_name">Claimant Name</Label>
                    <Input
                      id="claimant_name"
                      value={formData.claimant_name}
                      onChange={(e) => setFormData({ ...formData, claimant_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="claimant_phone">Claimant Phone</Label>
                    <Input
                      id="claimant_phone"
                      value={formData.claimant_phone}
                      onChange={(e) => setFormData({ ...formData, claimant_phone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="claimant_relationship">Relationship to Deceased</Label>
                    <select
                      id="claimant_relationship"
                      value={formData.claimant_relationship}
                      onChange={(e) => setFormData({ ...formData, claimant_relationship: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="spouse">Spouse</option>
                      <option value="child">Child</option>
                      <option value="parent">Parent</option>
                      <option value="sibling">Sibling</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createCaseMutation.isPending}>
                  {createCaseMutation.isPending ? 'Submitting...' : 'Submit Case'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {cases?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No burial cases yet</h3>
            <p className="text-gray-600 mb-4">Report burial and welfare cases to process benefits</p>
            <Button onClick={() => setIsAddFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Report First Case
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cases?.map((caseItem) => (
            <Card key={caseItem._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Case #{caseItem.case_number}</CardTitle>
                    <CardDescription>
                      {caseItem.deceased.full_name} • {new Date(caseItem.deceased.date_of_death).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(caseItem.status)}`}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(caseItem.status)}
                      {getStatusLabel(caseItem.status)}
                    </span>
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Case Type</p>
                    <p className="font-medium capitalize">{caseItem.case_type.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Relationship</p>
                    <p className="font-medium capitalize">{caseItem.deceased.relationship_to_member}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Claimant</p>
                    <p className="font-medium">{caseItem.claimant.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Benefit</p>
                    <p className="font-medium">
                      {caseItem.benefit?.approved_amount 
                        ? `KES ${caseItem.benefit.approved_amount}` 
                        : 'Pending'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="secondary">
                    View Details
                  </Button>
                  {caseItem.status === 'benefit_calculated' && (
                    <Button size="sm">
                      Process Benefit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}