import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '@/shared/components/ui/Card/Card';
import CardContent from '@/shared/components/ui/Card/CardContent';
import CardHeader from '@/shared/components/ui/Card/CardHeader';
import Button from '@/shared/components/ui/Button/Button';
import { toast } from 'react-hot-toast';

function CardDescription({ children }) {
  return <p className="text-sm text-gray-600">{children}</p>;
}

function CardTitle({ children }) {
  return <h3 className="text-lg font-semibold">{children}</h3>;
}
import { Download, Send, FileText, Smartphone, MessageSquare } from 'lucide-react';
import api from '@/app/services/api';

export default function MemberStatementPage() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();
  const [selectedFormat, setSelectedFormat] = useState('app');
  const [selectedLanguage, setSelectedLanguage] = useState('sw');
  const [generating, setGenerating] = useState(false);

  // Generate statement mutation
  const generateStatementMutation = useMutation({
    mutationFn: async (format) => {
      const response = await api.post(
        `/api/v1/burial-chama/membership/${workspaceId}/statement`,
        {
          format,
          language: selectedLanguage
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Statement generated successfully');
      if (data.data.format === 'pdf') {
        // Handle PDF download
        window.open(data.data.file_url, '_blank');
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to generate statement');
    }
  });

  const handleGenerate = (format) => {
    setGenerating(true);
    generateStatementMutation.mutate(format, {
      onSettled: () => setGenerating(false)
    });
  };

  const statementFormats = [
    { id: 'app', name: 'App View', icon: Smartphone, description: 'View in app with charts and details' },
    { id: 'ussd', name: 'USSD Format', icon: MessageSquare, description: 'Concise format for USSD display' },
    { id: 'sms', name: 'SMS Format', icon: Send, description: 'Ultra-concise for SMS delivery' },
    { id: 'pdf', name: 'PDF Download', icon: Download, description: 'Download as PDF document' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Member Statement</h1>
        <p className="text-gray-600">Generate and view your contribution statement</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statement Options</CardTitle>
          <CardDescription>Choose your preferred format and language</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Format</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statementFormats.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    className={`p-4 border rounded-lg text-left transition-all ${
                      selectedFormat === format.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-gray-300'
                    }`}
                  >
                    <format.icon className="w-6 h-6 mb-2 text-gray-600" />
                    <h3 className="font-medium text-sm">{format.name}</h3>
                    <p className="text-xs text-gray-600 mt-1">{format.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full md:w-64 px-3 py-2 border rounded-md"
              >
                <option value="sw">Swahili</option>
                <option value="en">English</option>
              </select>
            </div>

            <Button
              onClick={() => handleGenerate(selectedFormat)}
              disabled={generating || generateStatementMutation.isPending}
              className="w-full md:w-auto"
            >
              {generating || generateStatementMutation.isPending ? (
                'Generating...'
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Statement
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Balance Section */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Balance</CardTitle>
          <CardDescription>Check your current balance via USSD</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className="text-2xl font-bold">KES 0.00</p>
            </div>
            <Button variant="secondary" size="sm">
              <MessageSquare className="w-4 h-4 mr-2" />
              Check via USSD
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statement Preview */}
      {selectedFormat === 'app' && (
        <Card>
          <CardHeader>
            <CardTitle>Statement Preview</CardTitle>
            <CardDescription>Preview of your contribution statement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Generate a statement to see the preview here
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}