import { useState, useEffect } from 'react';
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
import { Plus, Edit, Trash2, UserPlus, Phone, Calendar, MapPin, X } from 'lucide-react';
import api from '@/app/services/api';

export default function BeneficiariesPage() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    relationship: 'spouse',
    date_of_birth: '',
    phone: '',
    national_id: '',
    residence: ''
  });

  // Fetch beneficiaries
  const { data: beneficiaries, isLoading } = useQuery({
    queryKey: ['beneficiaries', workspaceId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/burial-chama/chama/${workspaceId}/beneficiaries`);
      return response.data.data;
    }
  });

  // Add beneficiary mutation
  const addBeneficiaryMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(
        `/api/v1/burial-chama/membership/${workspaceId}/beneficiaries`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Beneficiary added successfully');
      setIsAddFormOpen(false);
      setFormData({
        first_name: '',
        last_name: '',
        relationship: 'spouse',
        date_of_birth: '',
        phone: '',
        national_id: '',
        residence: ''
      });
      queryClient.invalidateQueries(['beneficiaries']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add beneficiary');
    }
  });

  // Update beneficiary mutation
  const updateBeneficiaryMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(
        `/api/v1/burial-chama/beneficiaries/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Beneficiary updated successfully');
      setSelectedBeneficiary(null);
      setIsAddFormOpen(false);
      queryClient.invalidateQueries(['beneficiaries']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update beneficiary');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedBeneficiary) {
      updateBeneficiaryMutation.mutate({ id: selectedBeneficiary._id, data: formData });
    } else {
      addBeneficiaryMutation.mutate(formData);
    }
  };

  const handleEdit = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setFormData({
      first_name: beneficiary.first_name,
      last_name: beneficiary.last_name,
      relationship: beneficiary.relationship,
      date_of_birth: beneficiary.date_of_birth?.split('T')[0] || '',
      phone: beneficiary.phone || '',
      national_id: beneficiary.national_id || '',
      residence: beneficiary.residence || ''
    });
    setIsAddFormOpen(true);
  };

  const handleDelete = (beneficiaryId) => {
    if (confirm('Are you sure you want to remove this beneficiary?')) {
      // Implement delete mutation
      toast.success('Beneficiary removed successfully');
    }
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
          <h1 className="text-2xl font-bold">Beneficiaries</h1>
          <p className="text-gray-600">Manage beneficiaries for burial benefits</p>
        </div>
        <Button onClick={() => setIsAddFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Beneficiary
        </Button>
      </div>

      {isAddFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedBeneficiary ? 'Edit Beneficiary' : 'Add Beneficiary'}</CardTitle>
            <CardDescription>
              {selectedBeneficiary ? 'Update beneficiary information' : 'Add a new beneficiary to your burial chama'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <select
                  id="relationship"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
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
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0712345678"
                />
              </div>
              <div>
                <Label htmlFor="national_id">National ID</Label>
                <Input
                  id="national_id"
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  placeholder="12345678"
                />
              </div>
              <div>
                <Label htmlFor="residence">Residence</Label>
                <Input
                  id="residence"
                  value={formData.residence}
                  onChange={(e) => setFormData({ ...formData, residence: e.target.value })}
                  placeholder="Physical address"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsAddFormOpen(false);
                    setSelectedBeneficiary(null);
                    setFormData({
                      first_name: '',
                      last_name: '',
                      relationship: 'spouse',
                      date_of_birth: '',
                      phone: '',
                      national_id: '',
                      residence: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addBeneficiaryMutation.isPending || updateBeneficiaryMutation.isPending}>
                  {addBeneficiaryMutation.isPending || updateBeneficiaryMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {beneficiaries?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No beneficiaries yet</h3>
            <p className="text-gray-600 mb-4">Add beneficiaries to ensure they're covered under your burial chama</p>
            <Button onClick={() => setIsAddFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Beneficiary
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {beneficiaries?.map((beneficiary) => (
            <Card key={beneficiary._id}>
              <CardHeader>
                <CardTitle className="text-lg">{beneficiary.full_name}</CardTitle>
                <CardDescription className="capitalize">{beneficiary.relationship}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Age: {beneficiary.age} years</span>
                  </div>
                  {beneficiary.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{beneficiary.phone}</span>
                    </div>
                  )}
                  {beneficiary.residence && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{beneficiary.residence}</span>
                    </div>
                  )}
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                    beneficiary.eligibility_status === 'eligible' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {beneficiary.eligibility_status}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEdit(beneficiary)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(beneficiary._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}