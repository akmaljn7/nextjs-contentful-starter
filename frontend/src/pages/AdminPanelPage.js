import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ImageUpload } from '@/components/ImageUpload';
import { formatPrice, formatDate } from '@/lib/utils';
import { 
  Users, 
  ShoppingBag,
  CheckCircle, 
  Clock, 
  XCircle,
  TrendingUp,
  Package,
  MessageSquare,
  Loader2,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  Eye,
  User,
  Monitor,
  Film,
  MapPin,
  Settings,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending_cash', label: 'Pending Cash' },
  { value: 'refunded', label: 'Refunded' },
];

const ROLE_OPTIONS = [
  { value: 'advertiser', label: 'Advertiser' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'admin', label: 'Admin' },
];

const PLATFORM_OPTIONS = [
  { value: 'Instagram', label: 'Instagram' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Twitter', label: 'Twitter' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'YouTube', label: 'YouTube' },
];

const BILLBOARD_TYPES = [
  { value: 'LED', label: 'LED Digital' },
  { value: 'Static', label: 'Static Banner' },
  { value: 'Lightbox', label: 'Lightbox' },
];

export const AdminPanelPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  
  // Data states
  const [orders, setOrders] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [billboards, setBillboards] = useState([]);
  const [digitalAds, setDigitalAds] = useState([]);
  const [kannywood, setKannywood] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalMode, setModalMode] = useState('create'); // create or edit
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchAllData();
  }, [user, navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        statsRes,
        ordersRes,
        consultationsRes,
        influencersRes,
        billboardsRes,
        kannywoodRes,
        digitalAdsRes,
        usersRes,
        settingsRes
      ] = await Promise.all([
        api.get('/admin/stats/summary'),
        api.get('/admin/orders'),
        api.get('/admin/consultations'),
        api.get('/admin/influencers'),
        api.get('/admin/billboards'),
        api.get('/admin/kannywood'),
        api.get('/admin/digital-ads'),
        api.get('/admin/users'),
        api.get('/admin/settings').catch(() => ({ data: {} })),
      ]);
      
      setStats(statsRes.data);
      setOrders(ordersRes.data);
      setConsultations(consultationsRes.data);
      setInfluencers(influencersRes.data);
      setBillboards(billboardsRes.data);
      setKannywood(kannywoodRes.data);
      setDigitalAds(digitalAdsRes.data || []);
      setUsers(usersRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = (type) => {
    setModalType(type);
    setModalMode('create');
    setSelectedItem(null);
    setFormData(getDefaultFormData(type));
    setShowModal(true);
  };

  const openEditModal = async (type, item) => {
    setModalType(type);
    setModalMode('edit');
    setSelectedItem(item);
    
    // For influencers and kannywood, fetch the full data with packages BEFORE showing modal
    if (type === 'influencer') {
      try {
        const response = await api.get(`/influencers/${item.id}`);
        const fullData = response.data;
        
        // If API has packages, use them. Otherwise check if item already has packages
        const packages = fullData.packages && fullData.packages.length > 0 
          ? fullData.packages 
          : (item.packages || []);
        
        setFormData({ ...fullData, packages });
        setShowModal(true);  // Show modal AFTER data is loaded
      } catch (error) {
        // Fallback to item data if API fails
        setFormData({ ...item, packages: item.packages || [] });
        setShowModal(true);
      }
    } else if (type === 'kannywood') {
      try {
        const response = await api.get(`/kannywood/${item.id}`);
        const fullData = response.data;
        
        const packages = fullData.packages && fullData.packages.length > 0 
          ? fullData.packages 
          : (item.packages || []);
        
        setFormData({ ...fullData, packages });
        setShowModal(true);  // Show modal AFTER data is loaded
      } catch (error) {
        setFormData({ ...item, packages: item.packages || [] });
        setShowModal(true);
      }
    } else {
      setFormData({ ...item });
      setShowModal(true);
    }
  };

  const getDefaultFormData = (type) => {
    switch (type) {
      case 'influencer':
        return {
          name: '', handle: '', platform: 'Instagram', followers: 0,
          niche: '', bio: '', location: '', price_per_post: 0,
          engagement_rate: 0, image_url: '', status: 'approved', packages: []
        };
      case 'billboard':
        return {
          name: '', type: 'LED', location: '', city: '', state: '',
          traffic: '', price: 0, description: '', image_url: '', status: 'approved'
        };
      case 'kannywood':
        return {
          title: '', director: '', genre: '', description: '',
          est_reach: '', release_date: '', price: 0, image_url: '', status: 'approved'
        };
      case 'user':
        return { name: '', email: '', phone: '', role: 'advertiser', verified: false };
      case 'order':
        return { order_status: 'pending', payment_status: 'pending', notes: '' };
      case 'consultation':
        return { status: 'pending', payment_status: 'pending', notes: '' };
      default:
        return {};
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let endpoint = '';
      let method = modalMode === 'create' ? 'post' : 'put';
      
      switch (modalType) {
        case 'influencer':
          endpoint = modalMode === 'create' 
            ? '/admin/influencers' 
            : `/admin/influencers/${selectedItem.id}`;
          break;
        case 'billboard':
          endpoint = modalMode === 'create' 
            ? '/admin/billboards' 
            : `/admin/billboards/${selectedItem.id}`;
          break;
        case 'kannywood':
          endpoint = modalMode === 'create' 
            ? '/admin/kannywood' 
            : `/admin/kannywood/${selectedItem.id}`;
          break;
        case 'digitalad':
          endpoint = modalMode === 'create' 
            ? '/admin/digital-ads' 
            : `/admin/digital-ads/${selectedItem.id}`;
          break;
        case 'user':
          endpoint = `/admin/users/${selectedItem.id}`;
          method = 'put';
          break;
        case 'order':
          endpoint = `/admin/orders/${selectedItem.id}`;
          method = 'put';
          break;
        case 'consultation':
          endpoint = `/admin/consultations/${selectedItem.id}`;
          method = 'put';
          break;
      }

      await api[method](endpoint, formData);
      toast.success(`${modalType} ${modalMode === 'create' ? 'created' : 'updated'} successfully`);
      setShowModal(false);
      fetchAllData();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(`Failed to ${modalMode} ${modalType}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (type, item) => {
    setItemToDelete({ type, item });
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const { type, item } = itemToDelete;
      let endpoint = '';
      
      switch (type) {
        case 'influencer': endpoint = `/admin/influencers/${item.id}`; break;
        case 'billboard': endpoint = `/admin/billboards/${item.id}`; break;
        case 'kannywood': endpoint = `/admin/kannywood/${item.id}`; break;
        case 'digitalad': endpoint = `/admin/digital-ads/${item.id}`; break;
        case 'user': endpoint = `/admin/users/${item.id}`; break;
        case 'order': endpoint = `/admin/orders/${item.id}`; break;
        case 'consultation': endpoint = `/admin/consultations/${item.id}`; break;
      }
      
      await api.delete(endpoint);
      toast.success(`${type} deleted successfully`);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      fetchAllData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(`Failed to delete ${itemToDelete.type}`);
    } finally {
      setDeleting(false);
    }
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-800',
      accepted: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-600 text-white',
      cancelled: 'bg-gray-100 text-gray-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-green-100 text-green-800',
      pending_cash: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={`${colors[status] || 'bg-gray-100'} border-0`}>
        {status?.replace(/_/g, ' ')}
      </Badge>
    );
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-background" data-testid="admin-panel-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Full control over all platform content and settings
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAllData} className="h-9">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
            <p className="text-muted-foreground">Loading admin panel...</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <Card className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.users?.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Users</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-accent/10 rounded-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.orders?.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{formatPrice(stats?.orders?.revenue || 0)}</p>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{(stats?.inventory?.influencers || 0) + (stats?.inventory?.billboards || 0) + (stats?.inventory?.kannywood || 0)}</p>
                      <p className="text-xs text-muted-foreground">Inventory</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
                <TabsTrigger value="overview" className="data-[state=active]:bg-white text-xs sm:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="influencers" className="data-[state=active]:bg-white text-xs sm:text-sm">Influencers</TabsTrigger>
                <TabsTrigger value="billboards" className="data-[state=active]:bg-white text-xs sm:text-sm">Billboards</TabsTrigger>
                <TabsTrigger value="kannywood" className="data-[state=active]:bg-white text-xs sm:text-sm">Kannywood</TabsTrigger>
                <TabsTrigger value="digitalads" className="data-[state=active]:bg-white text-xs sm:text-sm">Digital Ads</TabsTrigger>
                <TabsTrigger value="consultations" className="data-[state=active]:bg-white text-xs sm:text-sm">Consultations</TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-white text-xs sm:text-sm">Orders</TabsTrigger>
                <TabsTrigger value="users" className="data-[state=active]:bg-white text-xs sm:text-sm">Users</TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-white text-xs sm:text-sm">Settings</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="border-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <User className="h-5 w-5 mr-2 text-primary" />
                        Influencers ({influencers.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => openCreateModal('influencer')} className="w-full bg-accent hover:bg-accent/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Influencer
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-red-500" />
                        Billboards ({billboards.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => openCreateModal('billboard')} className="w-full bg-accent hover:bg-accent/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Billboard
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Film className="h-5 w-5 mr-2 text-purple-500" />
                        Kannywood ({kannywood.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => openCreateModal('kannywood')} className="w-full bg-accent hover:bg-accent/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Production
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <BarChart3 className="h-5 w-5 mr-2 text-blue-500" />
                        Digital Ads ({digitalAds.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => openCreateModal('digitalad')} className="w-full bg-accent hover:bg-accent/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Platform
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Stats */}
                <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <p className="text-2xl font-bold text-amber-700">{stats?.orders?.pending || 0}</p>
                    <p className="text-sm text-amber-600">Pending Orders</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-2xl font-bold text-green-700">{stats?.orders?.completed || 0}</p>
                    <p className="text-sm text-green-600">Completed Orders</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-2xl font-bold text-purple-700">{stats?.consultations?.pending || 0}</p>
                    <p className="text-sm text-purple-600">Pending Consultations</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-2xl font-bold text-blue-700">{stats?.users?.advertisers || 0}</p>
                    <p className="text-sm text-blue-600">Advertisers</p>
                  </div>
                </div>
              </TabsContent>

              {/* Influencers Tab */}
              <TabsContent value="influencers">
                <Card className="border-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Influencers</CardTitle>
                    <Button onClick={() => openCreateModal('influencer')} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" /> Add New
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-semibold">Name</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Platform</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Followers</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Price</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {influencers.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  {item.image_url && (
                                    <img src={item.image_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                  )}
                                  <div>
                                    <p className="font-medium text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">@{item.handle}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-sm">{item.platform}</td>
                              <td className="py-3 px-2 text-sm">{item.followers?.toLocaleString()}</td>
                              <td className="py-3 px-2 text-sm font-semibold">{formatPrice(item.price_per_post)}</td>
                              <td className="py-3 px-2">{getStatusBadge(item.status)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditModal('influencer', item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => confirmDelete('influencer', item)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Billboards Tab */}
              <TabsContent value="billboards">
                <Card className="border-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Billboards</CardTitle>
                    <Button onClick={() => openCreateModal('billboard')} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" /> Add New
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-semibold">Name</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Type</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Location</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Price</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billboards.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-2">
                                <p className="font-medium text-sm">{item.name || item.location_name}</p>
                              </td>
                              <td className="py-3 px-2 text-sm">{item.type || item.billboard_type}</td>
                              <td className="py-3 px-2 text-sm">{item.location || item.city}</td>
                              <td className="py-3 px-2 text-sm font-semibold">{formatPrice(item.price || item.price_monthly)}</td>
                              <td className="py-3 px-2">{getStatusBadge(item.status)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditModal('billboard', item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => confirmDelete('billboard', item)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Kannywood Tab */}
              <TabsContent value="kannywood">
                <Card className="border-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Kannywood Productions</CardTitle>
                    <Button onClick={() => openCreateModal('kannywood')} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" /> Add New
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-semibold">Title</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Director</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Genre</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Price</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kannywood.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-2 font-medium text-sm">{item.title}</td>
                              <td className="py-3 px-2 text-sm">{item.director}</td>
                              <td className="py-3 px-2 text-sm">{item.genre}</td>
                              <td className="py-3 px-2 text-sm font-semibold">{formatPrice(item.price)}</td>
                              <td className="py-3 px-2">{getStatusBadge(item.status)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditModal('kannywood', item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => confirmDelete('kannywood', item)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Digital Ads Tab */}
              <TabsContent value="digitalads">
                <Card className="border-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Digital Ad Platforms ({digitalAds.length})</CardTitle>
                    <Button onClick={() => openCreateModal('digitalad')} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" /> Add Platform
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-semibold">Platform</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Name</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Packages</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {digitalAds.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-2 font-medium">{item.platform || item.id}</td>
                              <td className="py-3 px-2">{item.name || item.service_name}</td>
                              <td className="py-3 px-2">
                                <Badge variant="outline">{(item.packages || []).length} packages</Badge>
                              </td>
                              <td className="py-3 px-2">{getStatusBadge(item.status)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditModal('digitalad', item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => confirmDelete('digitalad', item)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Consultations Tab */}
              <TabsContent value="consultations">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle>Manage Consultations ({consultations.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-semibold">Type</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Business</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Contact</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Requested</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Confirmed</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
                            <th className="text-right py-3 px-2 text-sm font-semibold">Price</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consultations.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-2 font-medium text-sm">{item.package_title}</td>
                              <td className="py-3 px-2">
                                <p className="text-sm">{item.business_name}</p>
                                <p className="text-xs text-muted-foreground">{item.industry}</p>
                              </td>
                              <td className="py-3 px-2">
                                <p className="text-sm">{item.contact_name}</p>
                                <p className="text-xs text-muted-foreground">{item.contact_phone}</p>
                              </td>
                              <td className="py-3 px-2">
                                <p className="text-sm">{item.preferred_date ? formatDate(item.preferred_date) : '-'}</p>
                                <p className="text-xs text-muted-foreground">{item.preferred_time || '-'}</p>
                              </td>
                              <td className="py-3 px-2">
                                {item.scheduled_date ? (
                                  <>
                                    <p className="text-sm font-medium text-green-700">{formatDate(item.scheduled_date)}</p>
                                    <p className="text-xs font-medium text-green-600">{item.scheduled_time || '-'}</p>
                                  </>
                                ) : (
                                  <span className="text-xs text-amber-600 font-medium">Not confirmed</span>
                                )}
                              </td>
                              <td className="py-3 px-2">{getStatusBadge(item.status || 'pending')}</td>
                              <td className="py-3 px-2 text-right font-semibold">{formatPrice(item.price)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditModal('consultation', item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => confirmDelete('consultation', item)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Orders Tab - All Orders (Services + Consultations) */}
              <TabsContent value="orders">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle>All Orders ({orders.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left py-3 px-2 text-sm font-semibold">Type</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Package</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Customer</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Date & Time</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Payment</th>
                            <th className="text-right py-3 px-2 text-sm font-semibold">Amount</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.slice(0, 100).map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-2">
                                <Badge 
                                  variant={item.order_type === 'consultation' ? 'secondary' : 'default'}
                                  className={item.order_type === 'consultation' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}
                                >
                                  {item.order_type === 'consultation' ? 'Consultation' : 'Service'}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1 capitalize">{item.listing_type?.replace(/_/g, ' ') || 'N/A'}</p>
                              </td>
                              <td className="py-3 px-2">
                                <p className="font-medium text-sm">{item.package_details?.packageTitle || item.package_details?.title || 'N/A'}</p>
                                <p className="text-xs text-muted-foreground font-mono">#{item.id?.slice(0, 8)}</p>
                                {item.order_type === 'consultation' && item.package_details?.business_name && (
                                  <p className="text-xs text-muted-foreground mt-1">{item.package_details.business_name}</p>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <p className="text-sm font-medium">{item.user_info?.name || 'N/A'}</p>
                                <p className="text-xs text-muted-foreground">{item.user_info?.email || '-'}</p>
                                {item.user_info?.phone && <p className="text-xs text-muted-foreground">{item.user_info.phone}</p>}
                              </td>
                              <td className="py-3 px-2">
                                <p className="text-sm">{formatDate(item.created_at)}</p>
                                {item.order_type === 'consultation' && item.scheduled_date && (
                                  <div className="mt-1 px-2 py-1 bg-green-50 rounded text-xs">
                                    <p className="text-green-700 font-medium">Scheduled:</p>
                                    <p className="text-green-600">{item.scheduled_date} {item.scheduled_time}</p>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2">{getStatusBadge(item.order_status)}</td>
                              <td className="py-3 px-2">
                                {getStatusBadge(item.payment_status)}
                                {item.payment_method && (
                                  <p className="text-xs text-muted-foreground mt-1 capitalize">{item.payment_method}</p>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right font-semibold text-primary">{formatPrice(item.total_amount)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => openEditModal(item.order_type === 'consultation' ? 'consultation' : 'order', item)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-500" 
                                    onClick={() => confirmDelete(item.order_type === 'consultation' ? 'consultation' : 'order', item)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle>Manage Users ({users.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-semibold">Name</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Email</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Phone</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Role</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Joined</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-2 font-medium text-sm">{item.name}</td>
                              <td className="py-3 px-2 text-sm">{item.email}</td>
                              <td className="py-3 px-2 text-sm">{item.phone}</td>
                              <td className="py-3 px-2">
                                <Badge className={`border-0 ${
                                  item.role === 'admin' ? 'bg-red-100 text-red-800' :
                                  item.role === 'supplier' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {item.role}
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-sm">{formatDate(item.created_at)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditModal('user', item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {item.id !== user.id && (
                                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => confirmDelete('user', item)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Settings className="h-5 w-5 mr-2" />
                      Site Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Site Name</Label>
                        <Input 
                          value={settings?.site_name || ''} 
                          onChange={(e) => setSettings(prev => ({ ...prev, site_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Tagline</Label>
                        <Input 
                          value={settings?.tagline || ''} 
                          onChange={(e) => setSettings(prev => ({ ...prev, tagline: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Contact Email</Label>
                        <Input 
                          value={settings?.contact_email || ''} 
                          onChange={(e) => setSettings(prev => ({ ...prev, contact_email: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Contact Phone</Label>
                        <Input 
                          value={settings?.contact_phone || ''} 
                          onChange={(e) => setSettings(prev => ({ ...prev, contact_phone: e.target.value }))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Office Address</Label>
                        <Input 
                          value={settings?.office_address || ''} 
                          onChange={(e) => setSettings(prev => ({ ...prev, office_address: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Business Hours</Label>
                        <Input 
                          value={settings?.business_hours || ''} 
                          onChange={(e) => setSettings(prev => ({ ...prev, business_hours: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Platform Fee (%)</Label>
                        <Input 
                          type="number"
                          value={settings?.platform_fee_percentage || 10} 
                          onChange={(e) => setSettings(prev => ({ ...prev, platform_fee_percentage: parseFloat(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Online Consultation Price</Label>
                        <Input 
                          type="number"
                          value={settings?.consultation_price_online || 15000} 
                          onChange={(e) => setSettings(prev => ({ ...prev, consultation_price_online: parseFloat(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Office Consultation Price</Label>
                        <Input 
                          type="number"
                          value={settings?.consultation_price_office || 25000} 
                          onChange={(e) => setSettings(prev => ({ ...prev, consultation_price_office: parseFloat(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={async () => {
                        try {
                          await api.put('/admin/settings', settings);
                          toast.success('Settings saved successfully');
                        } catch (error) {
                          toast.error('Failed to save settings');
                        }
                      }}
                      className="bg-accent hover:bg-accent/90"
                    >
                      Save Settings
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? 'Create' : 'Edit'} {modalType.charAt(0).toUpperCase() + modalType.slice(1)}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Influencer Form */}
            {modalType === 'influencer' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Name *</Label>
                    <Input value={formData.name || ''} onChange={(e) => updateFormField('name', e.target.value)} />
                  </div>
                  <div>
                    <Label>Handle *</Label>
                    <Input value={formData.handle || ''} onChange={(e) => updateFormField('handle', e.target.value)} placeholder="@username" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Platform</Label>
                    <Select value={formData.platform} onValueChange={(v) => updateFormField('platform', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Followers</Label>
                    <Input type="number" value={formData.followers || 0} onChange={(e) => updateFormField('followers', parseInt(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Niche</Label>
                    <Input value={formData.niche || ''} onChange={(e) => updateFormField('niche', e.target.value)} />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={formData.location || ''} onChange={(e) => updateFormField('location', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Bio</Label>
                  <Textarea value={formData.bio || ''} onChange={(e) => updateFormField('bio', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Price per Post (₦)</Label>
                    <Input type="number" value={formData.price_per_post || 0} onChange={(e) => updateFormField('price_per_post', parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <Label>Engagement Rate (%)</Label>
                    <Input type="number" step="0.1" value={formData.engagement_rate || 0} onChange={(e) => updateFormField('engagement_rate', parseFloat(e.target.value))} />
                  </div>
                </div>
                <ImageUpload
                  label="Profile Image"
                  value={formData.image_url || ''}
                  onChange={(url) => updateFormField('image_url', url)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Rating (1-5 stars)</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      max="5" 
                      step="0.1" 
                      value={formData.rating || 4.5} 
                      onChange={(e) => updateFormField('rating', parseFloat(e.target.value))} 
                      placeholder="e.g., 4.8"
                    />
                  </div>
                  <div>
                    <Label>Total Reviews</Label>
                    <Input 
                      type="number" 
                      value={formData.total_reviews || 0} 
                      onChange={(e) => updateFormField('total_reviews', parseInt(e.target.value))} 
                      placeholder="e.g., 156"
                    />
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status || 'approved'} onValueChange={(v) => updateFormField('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Packages Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">Service Packages</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const packages = formData.packages || [];
                        packages.push({
                          id: `pkg-${Date.now()}`,
                          title: '',
                          description: '',
                          price: 0,
                          delivery_time: '3-5 days',
                          deliverables: [],
                          features: []
                        });
                        updateFormField('packages', [...packages]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Package
                    </Button>
                  </div>
                  
                  {(formData.packages || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                      No packages yet. Click "Add Package" to create one.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {(formData.packages || []).map((pkg, index) => (
                        <div key={pkg.id || index} className="border rounded-lg p-3 bg-muted/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Package {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => {
                                const packages = [...(formData.packages || [])];
                                packages.splice(index, 1);
                                updateFormField('packages', packages);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Title</Label>
                              <Input
                                className="h-8 text-sm"
                                value={pkg.title || ''}
                                onChange={(e) => {
                                  const packages = [...(formData.packages || [])];
                                  packages[index].title = e.target.value;
                                  updateFormField('packages', packages);
                                }}
                                placeholder="e.g., Basic Shoutout"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Price (₦)</Label>
                              <Input
                                className="h-8 text-sm"
                                type="number"
                                value={pkg.price || 0}
                                onChange={(e) => {
                                  const packages = [...(formData.packages || [])];
                                  packages[index].price = parseFloat(e.target.value);
                                  updateFormField('packages', packages);
                                }}
                              />
                            </div>
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                              className="text-sm min-h-[60px]"
                              value={pkg.description || ''}
                              onChange={(e) => {
                                const packages = [...(formData.packages || [])];
                                packages[index].description = e.target.value;
                                updateFormField('packages', packages);
                              }}
                              placeholder="What's included in this package..."
                            />
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs">Delivery Time</Label>
                            <Input
                              className="h-8 text-sm"
                              value={pkg.delivery_time || ''}
                              onChange={(e) => {
                                const packages = [...(formData.packages || [])];
                                packages[index].delivery_time = e.target.value;
                                updateFormField('packages', packages);
                              }}
                              placeholder="e.g., 3-5 days"
                            />
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs">Deliverables (one per line)</Label>
                            <Textarea
                              className="text-sm min-h-[80px]"
                              value={(pkg.deliverables || []).join('\n')}
                              onChange={(e) => {
                                const packages = [...(formData.packages || [])];
                                packages[index].deliverables = e.target.value.split('\n').filter(item => item.trim() !== '');
                                updateFormField('packages', packages);
                              }}
                              placeholder="1 TikTok video&#10;Brand mention&#10;Story repost&#10;Analytics report"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Enter each deliverable on a new line</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Billboard Form */}
            {modalType === 'billboard' && (
              <>
                <div>
                  <Label>Name *</Label>
                  <Input value={formData.name || ''} onChange={(e) => updateFormField('name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={formData.type || 'LED'} onValueChange={(v) => updateFormField('type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BILLBOARD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Base Price (₦)</Label>
                    <Input type="number" value={formData.price || 0} onChange={(e) => updateFormField('price', parseFloat(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>City</Label>
                    <Input value={formData.city || ''} onChange={(e) => updateFormField('city', e.target.value)} placeholder="e.g., Kano" />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input value={formData.state || ''} onChange={(e) => updateFormField('state', e.target.value)} placeholder="e.g., Kano State" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Location Details</Label>
                    <Input value={formData.location || ''} onChange={(e) => updateFormField('location', e.target.value)} placeholder="Specific area/street" />
                  </div>
                  <div>
                    <Label>Daily Traffic</Label>
                    <Input value={formData.traffic || ''} onChange={(e) => updateFormField('traffic', e.target.value)} placeholder="e.g., 50,000 vehicles" />
                  </div>
                </div>
                <div>
                  <Label>Dimensions</Label>
                  <Input value={formData.dimensions || ''} onChange={(e) => updateFormField('dimensions', e.target.value)} placeholder="e.g., 48ft x 14ft" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={formData.description || ''} onChange={(e) => updateFormField('description', e.target.value)} />
                </div>
                <ImageUpload
                  label="Billboard Image"
                  value={formData.image_url || ''}
                  onChange={(url) => updateFormField('image_url', url)}
                />

                {/* Location-Based Pricing Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">Location-Based Pricing</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const pricing = formData.pricing_by_state || {};
                        const newState = `State_${Object.keys(pricing).length + 1}`;
                        pricing[newState] = { 
                          name: '', 
                          city: '', 
                          daily_rate: 0, 
                          weekly_rate: 0, 
                          monthly_rate: 0 
                        };
                        updateFormField('pricing_by_state', { ...pricing });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Location
                    </Button>
                  </div>
                  
                  {Object.keys(formData.pricing_by_state || {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                      No location pricing yet. Click "Add Location" to create one.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(formData.pricing_by_state || {}).map(([key, location], index) => (
                        <div key={key} className="border rounded-lg p-3 bg-muted/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Location {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => {
                                const pricing = { ...(formData.pricing_by_state || {}) };
                                delete pricing[key];
                                updateFormField('pricing_by_state', pricing);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">State Name</Label>
                              <Input
                                className="h-8 text-sm"
                                value={location.name || ''}
                                onChange={(e) => {
                                  const pricing = { ...(formData.pricing_by_state || {}) };
                                  pricing[key].name = e.target.value;
                                  updateFormField('pricing_by_state', pricing);
                                }}
                                placeholder="e.g., Kano"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">City</Label>
                              <Input
                                className="h-8 text-sm"
                                value={location.city || ''}
                                onChange={(e) => {
                                  const pricing = { ...(formData.pricing_by_state || {}) };
                                  pricing[key].city = e.target.value;
                                  updateFormField('pricing_by_state', pricing);
                                }}
                                placeholder="e.g., Kano City"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <div>
                              <Label className="text-xs">Daily (₦)</Label>
                              <Input
                                className="h-8 text-sm"
                                type="number"
                                value={location.daily_rate || 0}
                                onChange={(e) => {
                                  const pricing = { ...(formData.pricing_by_state || {}) };
                                  pricing[key].daily_rate = parseFloat(e.target.value);
                                  updateFormField('pricing_by_state', pricing);
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Weekly (₦)</Label>
                              <Input
                                className="h-8 text-sm"
                                type="number"
                                value={location.weekly_rate || 0}
                                onChange={(e) => {
                                  const pricing = { ...(formData.pricing_by_state || {}) };
                                  pricing[key].weekly_rate = parseFloat(e.target.value);
                                  updateFormField('pricing_by_state', pricing);
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Monthly (₦)</Label>
                              <Input
                                className="h-8 text-sm"
                                type="number"
                                value={location.monthly_rate || 0}
                                onChange={(e) => {
                                  const pricing = { ...(formData.pricing_by_state || {}) };
                                  pricing[key].monthly_rate = parseFloat(e.target.value);
                                  updateFormField('pricing_by_state', pricing);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Kannywood Form */}
            {modalType === 'kannywood' && (
              <>
                <div>
                  <Label>Title *</Label>
                  <Input value={formData.title || ''} onChange={(e) => updateFormField('title', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Director</Label>
                    <Input value={formData.director || ''} onChange={(e) => updateFormField('director', e.target.value)} />
                  </div>
                  <div>
                    <Label>Genre</Label>
                    <Input value={formData.genre || ''} onChange={(e) => updateFormField('genre', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Est. Reach</Label>
                    <Input value={formData.est_reach || ''} onChange={(e) => updateFormField('est_reach', e.target.value)} placeholder="e.g., 1.5m or 2,000,000" />
                  </div>
                  <div>
                    <Label>Price (₦)</Label>
                    <Input type="number" value={formData.price || 0} onChange={(e) => updateFormField('price', parseFloat(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Release Date</Label>
                    <Input 
                      type="date" 
                      value={formData.release_date || ''} 
                      onChange={(e) => updateFormField('release_date', e.target.value)} 
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={formData.status || 'approved'} onValueChange={(v) => updateFormField('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={formData.description || ''} onChange={(e) => updateFormField('description', e.target.value)} />
                </div>
                <ImageUpload
                  label="Production Image"
                  value={formData.image_url || ''}
                  onChange={(url) => updateFormField('image_url', url)}
                />

                {/* Packages Section for Kannywood */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">Advertising Packages</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const packages = formData.packages || [];
                        packages.push({
                          id: `pkg-${Date.now()}`,
                          title: '',
                          description: '',
                          price: 0,
                          deliverables: [],
                          features: []
                        });
                        updateFormField('packages', [...packages]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Package
                    </Button>
                  </div>
                  
                  {(formData.packages || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                      No packages yet. Click "Add Package" to create one.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {(formData.packages || []).map((pkg, index) => (
                        <div key={pkg.id || index} className="border rounded-lg p-3 bg-muted/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Package {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => {
                                const packages = [...(formData.packages || [])];
                                packages.splice(index, 1);
                                updateFormField('packages', packages);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Title</Label>
                              <Input
                                className="h-8 text-sm"
                                value={pkg.title || ''}
                                onChange={(e) => {
                                  const packages = [...(formData.packages || [])];
                                  packages[index].title = e.target.value;
                                  updateFormField('packages', packages);
                                }}
                                placeholder="e.g., Product Placement"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Price (₦)</Label>
                              <Input
                                className="h-8 text-sm"
                                type="number"
                                value={pkg.price || 0}
                                onChange={(e) => {
                                  const packages = [...(formData.packages || [])];
                                  packages[index].price = parseFloat(e.target.value);
                                  updateFormField('packages', packages);
                                }}
                              />
                            </div>
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                              className="text-sm min-h-[60px]"
                              value={pkg.description || ''}
                              onChange={(e) => {
                                const packages = [...(formData.packages || [])];
                                packages[index].description = e.target.value;
                                updateFormField('packages', packages);
                              }}
                              placeholder="What's included in this package..."
                            />
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs">Deliverables (one per line)</Label>
                            <Textarea
                              className="text-sm min-h-[80px]"
                              value={(pkg.deliverables || []).join('\n')}
                              onChange={(e) => {
                                const packages = [...(formData.packages || [])];
                                packages[index].deliverables = e.target.value.split('\n').filter(item => item.trim() !== '');
                                updateFormField('packages', packages);
                              }}
                              placeholder="Product visible in 3-5 scenes&#10;Natural background placement&#10;Certificate of placement&#10;Behind-the-scenes photo"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Enter each deliverable on a new line</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Digital Ad Form */}
            {modalType === 'digitalad' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Platform ID</Label>
                    <Input 
                      value={formData.id || ''} 
                      onChange={(e) => updateFormField('id', e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
                      placeholder="e.g., facebook, instagram, tiktok"
                      disabled={modalMode === 'edit'}
                    />
                  </div>
                  <div>
                    <Label>Platform Name</Label>
                    <Input value={formData.name || ''} onChange={(e) => updateFormField('name', e.target.value)} placeholder="e.g., Facebook Ads" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Platform</Label>
                    <Input value={formData.platform || ''} onChange={(e) => updateFormField('platform', e.target.value)} placeholder="e.g., Facebook, Instagram" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={formData.status || 'approved'} onValueChange={(v) => updateFormField('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={formData.description || ''} onChange={(e) => updateFormField('description', e.target.value)} placeholder="Platform description..." />
                </div>
                <ImageUpload
                  label="Platform Image"
                  value={formData.image_url || ''}
                  onChange={(url) => updateFormField('image_url', url)}
                />

                {/* Digital Ad Packages Section */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Advertising Packages</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const packages = formData.packages || [];
                        packages.push({
                          id: `pkg-${Date.now()}`,
                          title: '',
                          description: '',
                          price: 0,
                          duration: '1 Month',
                          ad_spend: '',
                          deliverables: []
                        });
                        updateFormField('packages', [...packages]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Package
                    </Button>
                  </div>
                  
                  {(formData.packages || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                      No packages yet. Click "Add Package" to create one.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {(formData.packages || []).map((pkg, index) => (
                        <div key={pkg.id || index} className="border rounded-lg p-3 bg-muted/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Package {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => {
                                const packages = [...(formData.packages || [])];
                                packages.splice(index, 1);
                                updateFormField('packages', packages);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Title</Label>
                              <Input
                                className="h-8 text-sm"
                                value={pkg.title || ''}
                                onChange={(e) => {
                                  const packages = [...(formData.packages || [])];
                                  packages[index].title = e.target.value;
                                  updateFormField('packages', packages);
                                }}
                                placeholder="e.g., Starter Package"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Price (₦)</Label>
                              <Input
                                className="h-8 text-sm"
                                type="number"
                                value={pkg.price || 0}
                                onChange={(e) => {
                                  const packages = [...(formData.packages || [])];
                                  packages[index].price = parseFloat(e.target.value);
                                  updateFormField('packages', packages);
                                }}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <Label className="text-xs">Duration</Label>
                              <Input
                                className="h-8 text-sm"
                                value={pkg.duration || ''}
                                onChange={(e) => {
                                  const packages = [...(formData.packages || [])];
                                  packages[index].duration = e.target.value;
                                  updateFormField('packages', packages);
                                }}
                                placeholder="e.g., 1 Month"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Ad Spend Included</Label>
                              <Input
                                className="h-8 text-sm"
                                value={pkg.ad_spend || ''}
                                onChange={(e) => {
                                  const packages = [...(formData.packages || [])];
                                  packages[index].ad_spend = e.target.value;
                                  updateFormField('packages', packages);
                                }}
                                placeholder="e.g., 30,000 included"
                              />
                            </div>
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                              className="text-sm min-h-[60px]"
                              value={pkg.description || ''}
                              onChange={(e) => {
                                const packages = [...(formData.packages || [])];
                                packages[index].description = e.target.value;
                                updateFormField('packages', packages);
                              }}
                              placeholder="What's included in this package..."
                            />
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs">Deliverables (one per line)</Label>
                            <Textarea
                              className="text-sm min-h-[80px]"
                              value={(pkg.deliverables || []).join('\n')}
                              onChange={(e) => {
                                const packages = [...(formData.packages || [])];
                                packages[index].deliverables = e.target.value.split('\n').filter(item => item.trim() !== '');
                                updateFormField('packages', packages);
                              }}
                              placeholder="Campaign setup & optimization&#10;2 ad creatives&#10;Weekly performance report&#10;Up to 10,000 reach"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Enter each deliverable on a new line</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* User Form */}
            {modalType === 'user' && (
              <>
                <div>
                  <Label>Name</Label>
                  <Input value={formData.name || ''} onChange={(e) => updateFormField('name', e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={formData.email || ''} onChange={(e) => updateFormField('email', e.target.value)} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={formData.phone || ''} onChange={(e) => updateFormField('phone', e.target.value)} />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={formData.role || 'advertiser'} onValueChange={(v) => updateFormField('role', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Order Form */}
            {modalType === 'order' && (
              <>
                <div className="bg-muted/30 rounded-lg p-3 mb-4">
                  <p className="font-medium">{selectedItem?.package_details?.packageTitle || selectedItem?.listing_type}</p>
                  <p className="text-sm text-muted-foreground">Customer: {selectedItem?.user_info?.name}</p>
                  <p className="text-sm font-bold text-accent">{formatPrice(selectedItem?.total_amount)}</p>
                </div>
                <div>
                  <Label>Order Status</Label>
                  <Select value={formData.order_status || 'pending'} onValueChange={(v) => updateFormField('order_status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Select value={formData.payment_status || 'pending'} onValueChange={(v) => updateFormField('payment_status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={formData.notes || ''} onChange={(e) => updateFormField('notes', e.target.value)} placeholder="Internal notes..." />
                </div>
              </>
            )}

            {/* Consultation Form */}
            {modalType === 'consultation' && (
              <>
                {/* Customer Request Details (Read-only) */}
                <div className="bg-muted/30 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Customer Request</p>
                  <p className="font-medium">{selectedItem?.package_title}</p>
                  <p className="text-sm text-muted-foreground">Business: {selectedItem?.business_name}</p>
                  <p className="text-sm text-muted-foreground">Industry: {selectedItem?.industry}</p>
                  <p className="text-sm text-muted-foreground">Contact: {selectedItem?.contact_name} - {selectedItem?.contact_phone}</p>
                  <p className="text-sm text-muted-foreground">Email: {selectedItem?.contact_email}</p>
                  {selectedItem?.preferred_date && (
                    <p className="text-sm text-muted-foreground">
                      Requested Date: <span className="font-medium text-foreground">{formatDate(selectedItem?.preferred_date)}</span>
                    </p>
                  )}
                  {selectedItem?.preferred_time && (
                    <p className="text-sm text-muted-foreground">
                      Requested Time: <span className="font-medium text-foreground">{selectedItem?.preferred_time}</span>
                    </p>
                  )}
                  {selectedItem?.description && (
                    <p className="text-sm text-muted-foreground mt-2">Description: {selectedItem?.description}</p>
                  )}
                  {selectedItem?.goals && (
                    <p className="text-sm text-muted-foreground">Goals: {selectedItem?.goals}</p>
                  )}
                  {selectedItem?.budget_range && (
                    <p className="text-sm text-muted-foreground">Budget: {selectedItem?.budget_range}</p>
                  )}
                  <p className="text-sm font-bold text-accent mt-2">{formatPrice(selectedItem?.price)}</p>
                </div>

                {/* Admin Editable Fields */}
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Admin Settings</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Status</Label>
                      <Select value={formData.status || 'pending'} onValueChange={(v) => updateFormField('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Payment Status</Label>
                      <Select value={formData.payment_status || 'pending'} onValueChange={(v) => updateFormField('payment_status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Confirmed Schedule - Highlighted */}
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-semibold text-green-800 mb-2 uppercase">Confirmed Schedule (Visible to Customer)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-green-700">Confirmed Date</Label>
                        <Input 
                          type="date" 
                          value={formData.scheduled_date || ''} 
                          onChange={(e) => updateFormField('scheduled_date', e.target.value)}
                          className="border-green-300 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <Label className="text-green-700">Confirmed Time</Label>
                        <Select value={formData.scheduled_time || ''} onValueChange={(v) => updateFormField('scheduled_time', v)}>
                          <SelectTrigger className="border-green-300"><SelectValue placeholder="Select time" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                            <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                            <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                            <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                            <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                            <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                            <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                            <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-green-600 mt-2">This date/time will be shown to the customer in their dashboard.</p>
                  </div>

                  <div className="mt-4">
                    <Label>Admin Notes (Internal Only)</Label>
                    <Textarea value={formData.notes || ''} onChange={(e) => updateFormField('notes', e.target.value)} placeholder="Internal notes..." />
                  </div>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {modalMode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
