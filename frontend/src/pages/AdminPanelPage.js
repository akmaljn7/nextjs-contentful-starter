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
import { MultiMediaUpload } from '@/components/MultiMediaUpload';
import { ProofUrlInput } from '@/components/ProofUrlInput';
import { formatPrice, formatDate, formatNumber } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  GripVertical,
  Eye,
  EyeOff,
  User,
  Monitor,
  Film,
  MapPin,
  Settings,
  BarChart3,
  AlertCircle,
  Search,
  X,
  Image,
  Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';

// Reusable Search Bar Component
const AdminSearchBar = ({ value, onChange, placeholder, resultCount, totalCount }) => (
  <div className="relative mb-4">
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          data-testid="admin-search-input"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
    {value && (
      <p className="text-xs text-muted-foreground mt-1">
        Showing {resultCount} of {totalCount} results
      </p>
    )}
  </div>
);

// Sortable Row Component for Influencers
const SortableInfluencerRow = ({ item, formatPrice, getStatusBadge, toggleVisibility, openEditModal, confirmDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? 'rgba(196, 163, 90, 0.1)' : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b hover:bg-muted/30 ${item.visible === false ? 'opacity-50 bg-muted/20' : ''}`}
    >
      <td className="py-3 px-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </td>
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
        <div className="flex items-center justify-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => toggleVisibility('influencer', item)}
            title={item.visible === false ? "Show to users" : "Hide from users"}
          >
            {item.visible === false ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-green-600" />
            )}
          </Button>
        </div>
      </td>
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
  );
};

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

// LED Config Tab Component
const LEDConfigTab = ({ states, sizes, packages, onRefresh }) => {
  const [activeSection, setActiveSection] = useState('states');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'state', 'size', 'package'
  const [modalMode, setModalMode] = useState('create');
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [newRoad, setNewRoad] = useState({ name: '', description: '' });
  const [newDeliverable, setNewDeliverable] = useState('');

  const openCreateModal = (type) => {
    setModalType(type);
    setModalMode('create');
    if (type === 'state') {
      setFormData({ name: '', roads: [] });
    } else if (type === 'size') {
      setFormData({ name: '', description: '' });
    } else if (type === 'package') {
      setFormData({ state_id: '', road_name: '', size_id: '', title: '', description: '', price: '', duration: '', deliverables: [], image_url: '' });
    }
    setShowModal(true);
  };

  const openEditModal = (type, item) => {
    setModalType(type);
    setModalMode('edit');
    setFormData({ ...item });
    setShowModal(true);
  };

  const addRoad = () => {
    if (!newRoad.name.trim()) return;
    setFormData(prev => ({
      ...prev,
      roads: [...(prev.roads || []), { name: newRoad.name.trim(), description: newRoad.description.trim() }]
    }));
    setNewRoad({ name: '', description: '' });
  };

  const removeRoad = (index) => {
    setFormData(prev => ({
      ...prev,
      roads: prev.roads.filter((_, i) => i !== index)
    }));
  };

  const addDeliverable = () => {
    if (!newDeliverable.trim()) return;
    setFormData(prev => ({
      ...prev,
      deliverables: [...(prev.deliverables || []), newDeliverable.trim()]
    }));
    setNewDeliverable('');
  };

  const removeDeliverable = (index) => {
    setFormData(prev => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let endpoint = '';
      let data = { ...formData };

      if (modalType === 'state') {
        endpoint = modalMode === 'create' ? '/led-billboard/states' : `/led-billboard/states/${formData.id}`;
      } else if (modalType === 'size') {
        endpoint = modalMode === 'create' ? '/led-billboard/sizes' : `/led-billboard/sizes/${formData.id}`;
      } else if (modalType === 'package') {
        endpoint = modalMode === 'create' ? '/led-billboard/packages' : `/led-billboard/packages/${formData.id}`;
        data.price = parseFloat(data.price) || 0;
      }

      if (modalMode === 'create') {
        await api.post(endpoint, data);
        toast.success(`${modalType} created successfully`);
      } else {
        await api.put(endpoint, data);
        toast.success(`${modalType} updated successfully`);
      }

      setShowModal(false);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to save ${modalType}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      await api.delete(`/led-billboard/${type}s/${id}`);
      toast.success(`${type} deleted successfully`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to delete ${type}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={activeSection === 'states' ? 'default' : 'outline'}
          onClick={() => setActiveSection('states')}
          className={activeSection === 'states' ? 'bg-accent' : ''}
        >
          <MapPin className="h-4 w-4 mr-2" /> States & Roads ({states.length})
        </Button>
        <Button 
          variant={activeSection === 'sizes' ? 'default' : 'outline'}
          onClick={() => setActiveSection('sizes')}
          className={activeSection === 'sizes' ? 'bg-accent' : ''}
        >
          <Monitor className="h-4 w-4 mr-2" /> LED Sizes ({sizes.length})
        </Button>
        <Button 
          variant={activeSection === 'packages' ? 'default' : 'outline'}
          onClick={() => setActiveSection('packages')}
          className={activeSection === 'packages' ? 'bg-accent' : ''}
        >
          <Package className="h-4 w-4 mr-2" /> Packages ({packages.length})
        </Button>
      </div>

      {/* States Section */}
      {activeSection === 'states' && (
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Manage States & Roads</CardTitle>
            <Button onClick={() => openCreateModal('state')} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Add State
            </Button>
          </CardHeader>
          <CardContent>
            {states.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No states configured yet. Add your first state to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {states.map((state) => (
                  <div key={state.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">{state.name}</h3>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal('state', state)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('state', state.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(state.roads || []).map((road, idx) => (
                        <Badge key={idx} variant="secondary" className="text-sm">
                          {road.name}
                        </Badge>
                      ))}
                      {(!state.roads || state.roads.length === 0) && (
                        <span className="text-sm text-muted-foreground">No roads configured</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sizes Section */}
      {activeSection === 'sizes' && (
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Manage LED Sizes</CardTitle>
            <Button onClick={() => openCreateModal('size')} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Add Size
            </Button>
          </CardHeader>
          <CardContent>
            {sizes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No sizes configured yet. Add LED billboard sizes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-sm font-semibold">Size Name</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Description</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((size) => (
                      <tr key={size.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-2 font-medium">{size.name}</td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">{size.description || '-'}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal('size', size)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('size', size.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Packages Section */}
      {activeSection === 'packages' && (
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Manage LED Packages</CardTitle>
            <Button onClick={() => openCreateModal('package')} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Add Package
            </Button>
          </CardHeader>
          <CardContent>
            {packages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No packages configured yet. Create packages for state + road + size combinations.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-sm font-semibold">Title</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">State</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Road</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Size</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Price</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Duration</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr key={pkg.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-2 font-medium">{pkg.title}</td>
                        <td className="py-3 px-2 text-sm">{pkg.state_name}</td>
                        <td className="py-3 px-2 text-sm">{pkg.road_name}</td>
                        <td className="py-3 px-2 text-sm">{pkg.size_name}</td>
                        <td className="py-3 px-2 font-semibold">{formatPrice(pkg.price)}</td>
                        <td className="py-3 px-2 text-sm">{pkg.duration}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal('package', pkg)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('package', pkg.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal for Create/Edit */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? 'Add' : 'Edit'} {modalType === 'state' ? 'State' : modalType === 'size' ? 'LED Size' : 'Package'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* State Form */}
            {modalType === 'state' && (
              <>
                <div className="space-y-2">
                  <Label>State Name *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Kano State"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Roads / Locations</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newRoad.name}
                      onChange={(e) => setNewRoad(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Road name (e.g., Zoo Road)"
                      className="flex-1"
                    />
                    <Button type="button" onClick={addRoad} variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={newRoad.description}
                    onChange={(e) => setNewRoad(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description (optional)"
                    className="text-sm"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.roads || []).map((road, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {road.name}
                        <button onClick={() => removeRoad(idx)} className="ml-1 hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Size Form */}
            {modalType === 'size' && (
              <>
                <div className="space-y-2">
                  <Label>Size Name *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., 40ft x 12ft"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Large billboard for highways"
                  />
                </div>
              </>
            )}

            {/* Package Form */}
            {modalType === 'package' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Select
                      value={formData.state_id || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, state_id: v, road_name: '' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Road *</Label>
                    <Select
                      value={formData.road_name || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, road_name: v }))}
                      disabled={!formData.state_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select road" />
                      </SelectTrigger>
                      <SelectContent>
                        {(states.find(s => s.id === formData.state_id)?.roads || []).map((r, idx) => (
                          <SelectItem key={idx} value={r.name}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>LED Size *</Label>
                  <Select
                    value={formData.size_id || ''}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, size_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Package Title *</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Monthly Premium Package"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Package description..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (NGN) *</Label>
                    <Input
                      type="number"
                      value={formData.price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration *</Label>
                    <Input
                      value={formData.duration || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g., 1 Month"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Deliverables</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newDeliverable}
                      onChange={(e) => setNewDeliverable(e.target.value)}
                      placeholder="e.g., 24/7 display"
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDeliverable())}
                    />
                    <Button type="button" onClick={addDeliverable} variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.deliverables || []).map((d, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {d}
                        <button onClick={() => removeDeliverable(idx)} className="ml-1 hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <ImageUpload
                  label="Package Image"
                  value={formData.image_url || ''}
                  onChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {modalMode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Static/Lightbox Billboard Config Tab Component
const StaticBillboardConfigTab = ({ states, billboardTypes, staticPackages, onRefresh }) => {
  const [activeSection, setActiveSection] = useState('types');
  const [selectedCategory, setSelectedCategory] = useState('static_banner'); // 'static_banner' or 'lightbox'
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'type', 'package'
  const [modalMode, setModalMode] = useState('create');
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState('');

  const filteredTypes = billboardTypes.filter(t => t.billboard_category === selectedCategory);
  const filteredPackages = staticPackages.filter(p => p.billboard_category === selectedCategory);

  const openCreateModal = (type) => {
    setModalType(type);
    setModalMode('create');
    if (type === 'type') {
      setFormData({ name: '', description: '', billboard_category: selectedCategory });
    } else if (type === 'package') {
      setFormData({ billboard_category: selectedCategory, state_id: '', road_name: '', type_id: '', title: '', description: '', price: '', duration: '', deliverables: [], image_url: '' });
    }
    setShowModal(true);
  };

  const openEditModal = (type, item) => {
    setModalType(type);
    setModalMode('edit');
    setFormData({ ...item });
    setShowModal(true);
  };

  const addDeliverable = () => {
    if (!newDeliverable.trim()) return;
    setFormData(prev => ({
      ...prev,
      deliverables: [...(prev.deliverables || []), newDeliverable.trim()]
    }));
    setNewDeliverable('');
  };

  const removeDeliverable = (index) => {
    setFormData(prev => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let endpoint = '';
      let data = { ...formData };

      if (modalType === 'type') {
        endpoint = modalMode === 'create' ? '/billboard-types' : `/billboard-types/${formData.id}`;
        data.billboard_category = selectedCategory;
      } else if (modalType === 'package') {
        endpoint = modalMode === 'create' ? '/static-billboard/packages' : `/static-billboard/packages/${formData.id}`;
        data.price = parseFloat(data.price) || 0;
        data.billboard_category = selectedCategory;
      }

      if (modalMode === 'create') {
        await api.post(endpoint, data);
        toast.success(`${modalType} created successfully`);
      } else {
        await api.put(endpoint, data);
        toast.success(`${modalType} updated successfully`);
      }

      setShowModal(false);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to save ${modalType}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      if (type === 'type') {
        await api.delete(`/billboard-types/${id}`);
      } else {
        await api.delete(`/static-billboard/packages/${id}`);
      }
      toast.success(`${type} deleted successfully`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to delete ${type}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Toggle */}
      <div className="flex gap-4 p-4 bg-muted/30 rounded-lg">
        <Button 
          variant={selectedCategory === 'static_banner' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('static_banner')}
          className={selectedCategory === 'static_banner' ? 'bg-accent' : ''}
        >
          <Image className="h-4 w-4 mr-2" /> Static Banner
        </Button>
        <Button 
          variant={selectedCategory === 'lightbox' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('lightbox')}
          className={selectedCategory === 'lightbox' ? 'bg-accent' : ''}
        >
          <Lightbulb className="h-4 w-4 mr-2" /> Lightbox
        </Button>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={activeSection === 'types' ? 'default' : 'outline'}
          onClick={() => setActiveSection('types')}
          className={activeSection === 'types' ? 'bg-primary' : ''}
        >
          Billboard Types ({filteredTypes.length})
        </Button>
        <Button 
          variant={activeSection === 'packages' ? 'default' : 'outline'}
          onClick={() => setActiveSection('packages')}
          className={activeSection === 'packages' ? 'bg-primary' : ''}
        >
          <Package className="h-4 w-4 mr-2" /> Packages ({filteredPackages.length})
        </Button>
      </div>

      {/* Types Section */}
      {activeSection === 'types' && (
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {selectedCategory === 'static_banner' ? 'Static Banner' : 'Lightbox'} Types
            </CardTitle>
            <Button onClick={() => openCreateModal('type')} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Add Type
            </Button>
          </CardHeader>
          <CardContent>
            {filteredTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No types configured yet for {selectedCategory === 'static_banner' ? 'Static Banner' : 'Lightbox'}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-sm font-semibold">Type Name</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Description</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTypes.map((type) => (
                      <tr key={type.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-2 font-medium">{type.name}</td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">{type.description || '-'}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal('type', type)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('type', type.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Packages Section */}
      {activeSection === 'packages' && (
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {selectedCategory === 'static_banner' ? 'Static Banner' : 'Lightbox'} Packages
            </CardTitle>
            <Button onClick={() => openCreateModal('package')} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Add Package
            </Button>
          </CardHeader>
          <CardContent>
            {filteredPackages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No packages configured yet. Create packages for state + road + type combinations.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-sm font-semibold">Title</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">State</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Road</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Type</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Price</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Duration</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackages.map((pkg) => (
                      <tr key={pkg.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-2 font-medium">{pkg.title}</td>
                        <td className="py-3 px-2 text-sm">{pkg.state_name}</td>
                        <td className="py-3 px-2 text-sm">{pkg.road_name}</td>
                        <td className="py-3 px-2 text-sm">{pkg.type_name}</td>
                        <td className="py-3 px-2 font-semibold">{formatPrice(pkg.price)}</td>
                        <td className="py-3 px-2 text-sm">{pkg.duration}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal('package', pkg)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('package', pkg.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal for Create/Edit */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? 'Add' : 'Edit'} {modalType === 'type' ? `${selectedCategory === 'static_banner' ? 'Static Banner' : 'Lightbox'} Type` : 'Package'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Type Form */}
            {modalType === 'type' && (
              <>
                <div className="space-y-2">
                  <Label>Type Name *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Standard, Premium, Illuminated"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., High-quality vinyl print"
                  />
                </div>
              </>
            )}

            {/* Package Form */}
            {modalType === 'package' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Select
                      value={formData.state_id || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, state_id: v, road_name: '' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Road *</Label>
                    <Select
                      value={formData.road_name || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, road_name: v }))}
                      disabled={!formData.state_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select road" />
                      </SelectTrigger>
                      <SelectContent>
                        {(states.find(s => s.id === formData.state_id)?.roads || []).map((r, idx) => (
                          <SelectItem key={idx} value={r.name}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Billboard Type *</Label>
                  <Select
                    value={formData.type_id || ''}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, type_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Package Title *</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Monthly Premium Package"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Package description..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (NGN) *</Label>
                    <Input
                      type="number"
                      value={formData.price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration *</Label>
                    <Input
                      value={formData.duration || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g., 1 Month"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Deliverables</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newDeliverable}
                      onChange={(e) => setNewDeliverable(e.target.value)}
                      placeholder="e.g., Professional installation"
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDeliverable())}
                    />
                    <Button type="button" onClick={addDeliverable} variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.deliverables || []).map((d, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {d}
                        <button onClick={() => removeDeliverable(idx)} className="ml-1 hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <ImageUpload
                  label="Package Image"
                  value={formData.image_url || ''}
                  onChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {modalMode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Independent Billboard Types Config Tab Component
const IndependentBillboardConfigTab = ({ states, independentTypes, independentPackages, onRefresh }) => {
  const [activeSection, setActiveSection] = useState('types');
  const [selectedType, setSelectedType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'type', 'package'
  const [modalMode, setModalMode] = useState('create');
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState('');

  const filteredPackages = selectedType 
    ? independentPackages.filter(p => p.billboard_type_id === selectedType.id)
    : [];

  const openCreateTypeModal = () => {
    setModalType('type');
    setModalMode('create');
    setFormData({ 
      name: '', 
      description: '', 
      is_independent: true,
      image_url: '',
      traffic_daily: 0,
      price_starting: 0
    });
    setShowModal(true);
  };

  const openEditTypeModal = (item) => {
    setModalType('type');
    setModalMode('edit');
    setFormData({ ...item, is_independent: true });
    setShowModal(true);
  };

  const openCreatePackageModal = () => {
    if (!selectedType) {
      toast.error('Please select a billboard type first');
      return;
    }
    setModalType('package');
    setModalMode('create');
    setFormData({ 
      billboard_type_id: selectedType.id,
      state_id: '', 
      road_name: '', 
      title: '', 
      description: '', 
      price: '', 
      duration: '', 
      deliverables: [], 
      image_url: '' 
    });
    setShowModal(true);
  };

  const openEditPackageModal = (item) => {
    setModalType('package');
    setModalMode('edit');
    setFormData({ ...item });
    setShowModal(true);
  };

  const addDeliverable = () => {
    if (!newDeliverable.trim()) return;
    setFormData(prev => ({
      ...prev,
      deliverables: [...(prev.deliverables || []), newDeliverable.trim()]
    }));
    setNewDeliverable('');
  };

  const removeDeliverable = (index) => {
    setFormData(prev => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let endpoint = '';
      let data = { ...formData };

      if (modalType === 'type') {
        endpoint = modalMode === 'create' ? '/billboard-types' : `/billboard-types/${formData.id}`;
        data.is_independent = true;
        data.billboard_category = null;
        data.traffic_daily = parseInt(data.traffic_daily) || 0;
        data.price_starting = parseFloat(data.price_starting) || 0;
      } else if (modalType === 'package') {
        endpoint = modalMode === 'create' ? '/static-billboard/packages' : `/static-billboard/packages/${formData.id}`;
        data.price = parseFloat(data.price) || 0;
        data.billboard_type_id = selectedType.id;
        data.billboard_category = null;
      }

      if (modalMode === 'create') {
        await api.post(endpoint, data);
        toast.success(`${modalType === 'type' ? 'Billboard type' : 'Package'} created successfully`);
      } else {
        await api.put(endpoint, data);
        toast.success(`${modalType === 'type' ? 'Billboard type' : 'Package'} updated successfully`);
      }

      setShowModal(false);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to save ${modalType}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async (id) => {
    if (!confirm('Are you sure you want to delete this billboard type? This will also affect its packages.')) return;

    try {
      await api.delete(`/billboard-types/${id}`);
      toast.success('Billboard type deleted successfully');
      if (selectedType?.id === id) {
        setSelectedType(null);
      }
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete billboard type');
    }
  };

  const handleDeletePackage = async (id) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      await api.delete(`/static-billboard/packages/${id}`);
      toast.success('Package deleted successfully');
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete package');
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-800">Independent Billboard Types</h3>
            <p className="text-sm text-blue-700 mt-1">
              Create custom billboard categories (e.g., "LED CAR", "Mobile Billboard") that will appear as separate cards on the public Billboards page alongside LED, Static Banner, and Lightbox.
            </p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={activeSection === 'types' ? 'default' : 'outline'}
          onClick={() => setActiveSection('types')}
          className={activeSection === 'types' ? 'bg-accent' : ''}
        >
          <Monitor className="h-4 w-4 mr-2" /> Billboard Types ({independentTypes.length})
        </Button>
        <Button 
          variant={activeSection === 'packages' ? 'default' : 'outline'}
          onClick={() => setActiveSection('packages')}
          className={activeSection === 'packages' ? 'bg-accent' : ''}
          disabled={!selectedType}
        >
          <Package className="h-4 w-4 mr-2" /> 
          {selectedType ? `${selectedType.name} Packages (${filteredPackages.length})` : 'Select a Type First'}
        </Button>
      </div>

      {/* Types Section */}
      {activeSection === 'types' && (
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Independent Billboard Types</CardTitle>
            <Button onClick={openCreateTypeModal} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Create New Type
            </Button>
          </CardHeader>
          <CardContent>
            {independentTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No independent billboard types created yet.</p>
                <p className="text-sm mt-2">Create your first custom billboard category to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {independentTypes.map((type) => (
                  <Card 
                    key={type.id} 
                    className={`border-2 cursor-pointer transition-all hover:shadow-lg ${selectedType?.id === type.id ? 'border-accent ring-2 ring-accent/30' : ''}`}
                    onClick={() => setSelectedType(type)}
                  >
                    <CardContent className="p-4">
                      {type.image_url && (
                        <img 
                          src={type.image_url} 
                          alt={type.name}
                          className="w-full h-32 object-cover rounded-lg mb-3"
                        />
                      )}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{type.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{type.description || 'No description'}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800 border-0">Independent</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t text-sm">
                        <span className="text-muted-foreground">Traffic: {formatNumber(type.traffic_daily || 0)}/day</span>
                        <span className="font-semibold text-primary">{formatPrice(type.price_starting || 0)}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={(e) => { e.stopPropagation(); openEditTypeModal(type); }}
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700"
                          onClick={(e) => { e.stopPropagation(); handleDeleteType(type.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Packages Section */}
      {activeSection === 'packages' && selectedType && (
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-accent" />
              {selectedType.name} Packages
            </CardTitle>
            <Button onClick={openCreatePackageModal} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Add Package
            </Button>
          </CardHeader>
          <CardContent>
            {filteredPackages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No packages configured for {selectedType.name}.</p>
                <p className="text-sm mt-2">Create packages with state + road combinations.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-sm font-semibold">Title</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">State</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Road</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Price</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold">Duration</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackages.map((pkg) => (
                      <tr key={pkg.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-2 font-medium">{pkg.title}</td>
                        <td className="py-3 px-2 text-sm">{pkg.state_name}</td>
                        <td className="py-3 px-2 text-sm">{pkg.road_name}</td>
                        <td className="py-3 px-2 font-semibold">{formatPrice(pkg.price)}</td>
                        <td className="py-3 px-2 text-sm">{pkg.duration}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditPackageModal(pkg)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeletePackage(pkg.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal for Create/Edit */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? 'Create' : 'Edit'} {modalType === 'type' ? 'Independent Billboard Type' : 'Package'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Type Form */}
            {modalType === 'type' && (
              <>
                <div className="space-y-2">
                  <Label>Type Name *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., LED CAR, Mobile Billboard, Transit Ads"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this billboard type..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Daily Traffic (Est.)</Label>
                    <Input
                      type="number"
                      value={formData.traffic_daily || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, traffic_daily: e.target.value }))}
                      placeholder="e.g., 50000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Starting Price (NGN)</Label>
                    <Input
                      type="number"
                      value={formData.price_starting || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_starting: e.target.value }))}
                      placeholder="e.g., 100000"
                    />
                  </div>
                </div>
                <ImageUpload
                  label="Display Image (shown on public page)"
                  value={formData.image_url || ''}
                  onChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                />
              </>
            )}

            {/* Package Form */}
            {modalType === 'package' && (
              <>
                <div className="p-3 bg-muted/50 rounded-lg mb-2">
                  <p className="text-sm">Creating package for: <strong>{selectedType?.name}</strong></p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Select
                      value={formData.state_id || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, state_id: v, road_name: '' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Road *</Label>
                    <Select
                      value={formData.road_name || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, road_name: v }))}
                      disabled={!formData.state_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select road" />
                      </SelectTrigger>
                      <SelectContent>
                        {(states.find(s => s.id === formData.state_id)?.roads || []).map((r, idx) => (
                          <SelectItem key={idx} value={r.name}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Package Title *</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Premium Monthly Package"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Package description..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (NGN) *</Label>
                    <Input
                      type="number"
                      value={formData.price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration *</Label>
                    <Input
                      value={formData.duration || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g., 1 Month"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Deliverables</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newDeliverable}
                      onChange={(e) => setNewDeliverable(e.target.value)}
                      placeholder="e.g., Full city coverage"
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDeliverable())}
                    />
                    <Button type="button" onClick={addDeliverable} variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.deliverables || []).map((d, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {d}
                        <button onClick={() => removeDeliverable(idx)} className="ml-1 hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <ImageUpload
                  label="Package Image"
                  value={formData.image_url || ''}
                  onChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {modalMode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const AdminPanelPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [statsVisibility, setStatsVisibility] = useState({
    users: true,
    orders: true,
    revenue: true,
    inventory: true
  });
  
  // Data states
  const [orders, setOrders] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [billboards, setBillboards] = useState([]);
  const [digitalAds, setDigitalAds] = useState([]);
  const [kannywood, setKannywood] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  
  // LED Config states
  const [ledStates, setLedStates] = useState([]);
  const [ledSizes, setLedSizes] = useState([]);
  const [ledPackages, setLedPackages] = useState([]);
  
  // Static/Lightbox Config states
  const [billboardTypes, setBillboardTypes] = useState([]);
  const [staticPackages, setStaticPackages] = useState([]);
  
  // Independent Billboard Types states
  const [independentTypes, setIndependentTypes] = useState([]);
  const [independentPackages, setIndependentPackages] = useState([]);
  
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
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Bulk selection states
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for influencers reordering
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = influencers.findIndex((item) => item.id === active.id);
      const newIndex = influencers.findIndex((item) => item.id === over.id);
      
      const newOrder = arrayMove(influencers, oldIndex, newIndex);
      setInfluencers(newOrder);
      
      // Save the new order to backend
      try {
        await api.post('/admin/influencers/reorder', {
          ordered_ids: newOrder.map(item => item.id)
        });
        toast.success('Influencer order saved');
      } catch (error) {
        toast.error('Failed to save order');
        // Revert on error
        fetchData();
      }
    }
  };
  
  // Search states for each tab
  const [searchQueries, setSearchQueries] = useState({
    orders: '',
    consultations: '',
    influencers: '',
    billboards: '',
    digitalAds: '',
    kannywood: '',
    users: ''
  });

  // Update search query for a specific tab
  const updateSearchQuery = (tab, query) => {
    setSearchQueries(prev => ({ ...prev, [tab]: query }));
  };

  // Smart filter function that searches across multiple fields
  const filterItems = (items, query, fields) => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase().trim();
    return items.filter(item => {
      return fields.some(field => {
        const value = field.split('.').reduce((obj, key) => obj?.[key], item);
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowerQuery);
      });
    });
  };

  // Filtered data for each tab
  const filteredOrders = filterItems(orders, searchQueries.orders, [
    'id', 'user_info.name', 'user_info.email', 'user_info.phone',
    'package_details.packageTitle', 'package_details.title', 'listing_type',
    'payment_status', 'order_status', 'payment_method'
  ]);

  const filteredConsultations = filterItems(consultations, searchQueries.consultations, [
    'id', 'business_name', 'contact_name', 'contact_email', 'contact_phone',
    'industry', 'package_title', 'status', 'payment_status'
  ]);

  const filteredInfluencers = filterItems(influencers, searchQueries.influencers, [
    'id', 'name', 'handle', 'platform', 'category', 'location', 'status'
  ]);

  const filteredBillboards = filterItems(billboards, searchQueries.billboards, [
    'id', 'name', 'type', 'location', 'status'
  ]);

  const filteredDigitalAds = filterItems(digitalAds, searchQueries.digitalAds, [
    'id', 'name', 'platform', 'status'
  ]);

  const filteredKannywood = filterItems(kannywood, searchQueries.kannywood, [
    'id', 'title', 'production_company', 'type', 'status'
  ]);

  const filteredUsers = filterItems(users, searchQueries.users, [
    'id', 'name', 'email', 'phone', 'role', 'company_name'
  ]);

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
        settingsRes,
        ledStatesRes,
        ledSizesRes,
        ledPackagesRes,
        billboardTypesRes,
        staticPackagesRes,
        independentTypesRes,
        independentPackagesRes
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
        api.get('/led-billboard/states').catch(() => ({ data: [] })),
        api.get('/led-billboard/sizes').catch(() => ({ data: [] })),
        api.get('/led-billboard/packages').catch(() => ({ data: [] })),
        api.get('/billboard-types').catch(() => ({ data: [] })),
        api.get('/static-billboard/packages').catch(() => ({ data: [] })),
        api.get('/billboard-types?independent_only=true').catch(() => ({ data: [] })),
        api.get('/static-billboard/packages').catch(() => ({ data: [] })),
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
      setLedStates(ledStatesRes.data || []);
      setLedSizes(ledSizesRes.data || []);
      setLedPackages(ledPackagesRes.data || []);
      // Filter billboardTypes to exclude independent types for the Static/Lightbox tab
      const allTypes = billboardTypesRes.data || [];
      setBillboardTypes(allTypes.filter(t => !t.is_independent));
      setStaticPackages(staticPackagesRes.data || []);
      // Set independent types and their packages
      setIndependentTypes(independentTypesRes.data || []);
      // Filter packages that have billboard_type_id (independent type packages)
      const allPackages = independentPackagesRes.data || [];
      setIndependentPackages(allPackages.filter(p => p.billboard_type_id));
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
    } else if (type === 'order') {
      // For orders, include completion_proof
      setFormData({ 
        ...item, 
        completion_proof: item.completion_proof || [] 
      });
      setShowModal(true);
    } else {
      setFormData({ ...item });
      setShowModal(true);
    }
  };

  // Format date with time
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  // Toggle visibility for influencers and kannywood
  const toggleVisibility = async (type, item) => {
    try {
      let endpoint;
      if (type === 'influencer') {
        endpoint = `/admin/influencers/${item.id}/visibility`;
      } else if (type === 'kannywood') {
        endpoint = `/admin/kannywood/${item.id}/visibility`;
      } else {
        return;
      }
      
      const response = await api.patch(endpoint);
      
      if (response.data.status === 'success') {
        // Update local state
        if (type === 'influencer') {
          setInfluencers(prev => prev.map(inf => 
            inf.id === item.id ? { ...inf, visible: response.data.visible } : inf
          ));
        } else if (type === 'kannywood') {
          setKannywood(prev => prev.map(kw => 
            kw.id === item.id ? { ...kw, visible: response.data.visible } : kw
          ));
        }
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error('Failed to toggle visibility');
      console.error('Toggle visibility error:', error);
    }
  };

  // View order details
  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
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
        return { order_status: 'pending', payment_status: 'pending', notes: '', completion_proof: [] };
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
          // If completion proof is provided, upload it separately
          if (formData.completion_proof && formData.completion_proof.length > 0) {
            try {
              await api.post(`/admin/orders/${selectedItem.id}/completion-proof`, {
                completion_proof: formData.completion_proof.map(f => ({
                  type: f.type || (f.url?.includes('video') ? 'video' : 'image'),
                  url: f.url || f
                }))
              });
            } catch (proofError) {
              console.error('Error uploading completion proof:', proofError);
            }
          }
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

  // Bulk delete orders
  const handleBulkDeleteOrders = async () => {
    if (selectedOrders.length === 0) return;
    setBulkDeleting(true);
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const orderId of selectedOrders) {
        try {
          const order = orders.find(o => o.id === orderId);
          const endpoint = order?.order_type === 'consultation' 
            ? `/admin/consultations/${orderId}` 
            : `/admin/orders/${orderId}`;
          await api.delete(endpoint);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} order(s)`);
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} order(s)`);
      }
      
      setSelectedOrders([]);
      setShowBulkDeleteConfirm(false);
      fetchAllData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete orders');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Toggle order selection
  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  // Toggle all orders selection
  const toggleAllOrdersSelection = () => {
    const currentPageOrders = filteredOrders.slice(0, 100).map(o => o.id);
    const allSelected = currentPageOrders.every(id => selectedOrders.includes(id));
    
    if (allSelected) {
      setSelectedOrders(prev => prev.filter(id => !currentPageOrders.includes(id)));
    } else {
      setSelectedOrders(prev => [...new Set([...prev, ...currentPageOrders])]);
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
              <Card className="border-2 relative">
                <button 
                  onClick={() => setStatsVisibility(prev => ({...prev, users: !prev.users}))}
                  className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full transition-colors z-10"
                  title={statsVisibility.users ? "Hide" : "Show"}
                >
                  {statsVisibility.users ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </button>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{statsVisibility.users ? (stats?.users?.total || 0) : '•••'}</p>
                      <p className="text-xs text-muted-foreground">Total Users</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 relative">
                <button 
                  onClick={() => setStatsVisibility(prev => ({...prev, orders: !prev.orders}))}
                  className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full transition-colors z-10"
                  title={statsVisibility.orders ? "Hide" : "Show"}
                >
                  {statsVisibility.orders ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </button>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-accent/10 rounded-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{statsVisibility.orders ? (stats?.orders?.total || 0) : '•••'}</p>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 relative">
                <button 
                  onClick={() => setStatsVisibility(prev => ({...prev, revenue: !prev.revenue}))}
                  className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full transition-colors z-10"
                  title={statsVisibility.revenue ? "Hide" : "Show"}
                >
                  {statsVisibility.revenue ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </button>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{statsVisibility.revenue ? formatPrice(stats?.orders?.revenue || 0) : '₦•••••'}</p>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 relative">
                <button 
                  onClick={() => setStatsVisibility(prev => ({...prev, inventory: !prev.inventory}))}
                  className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full transition-colors z-10"
                  title={statsVisibility.inventory ? "Hide" : "Show"}
                >
                  {statsVisibility.inventory ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </button>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{statsVisibility.inventory ? ((stats?.inventory?.influencers || 0) + (stats?.inventory?.billboards || 0) + (stats?.inventory?.kannywood || 0)) : '•••'}</p>
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
                <TabsTrigger value="ledconfig" className="data-[state=active]:bg-white text-xs sm:text-sm">LED Config</TabsTrigger>
                <TabsTrigger value="staticconfig" className="data-[state=active]:bg-white text-xs sm:text-sm">Static/Lightbox</TabsTrigger>
                <TabsTrigger value="independentconfig" className="data-[state=active]:bg-white text-xs sm:text-sm">Custom Types</TabsTrigger>
                <TabsTrigger value="kannywood" className="data-[state=active]:bg-white text-xs sm:text-sm">Kannywood</TabsTrigger>
                <TabsTrigger value="digitalads" className="data-[state=active]:bg-white text-xs sm:text-sm">Digital Ads</TabsTrigger>
                <TabsTrigger value="consultations" className="data-[state=active]:bg-white text-xs sm:text-sm">Consultations</TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-white text-xs sm:text-sm">Orders</TabsTrigger>
                <TabsTrigger value="users" className="data-[state=active]:bg-white text-xs sm:text-sm">Users</TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-white text-xs sm:text-sm">Settings</TabsTrigger>
                <TabsTrigger value="branding" className="data-[state=active]:bg-white text-xs sm:text-sm">Branding</TabsTrigger>
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
                    <CardTitle>Manage Influencers ({filteredInfluencers.length})</CardTitle>
                    <Button onClick={() => openCreateModal('influencer')} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" /> Add New
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <AdminSearchBar
                      value={searchQueries.influencers}
                      onChange={(q) => updateSearchQuery('influencers', q)}
                      placeholder="Search by name, handle, platform, category..."
                      resultCount={filteredInfluencers.length}
                      totalCount={influencers.length}
                    />
                    <div className="overflow-x-auto">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <GripVertical className="h-3 w-3" /> Drag to reorder influencers
                      </p>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="w-10 py-3 px-2"></th>
                              <th className="text-left py-3 px-2 text-sm font-semibold">Name</th>
                              <th className="text-left py-3 px-2 text-sm font-semibold">Platform</th>
                              <th className="text-left py-3 px-2 text-sm font-semibold">Followers</th>
                              <th className="text-left py-3 px-2 text-sm font-semibold">Price</th>
                              <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
                              <th className="text-center py-3 px-2 text-sm font-semibold">Visible</th>
                              <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            <SortableContext
                              items={filteredInfluencers.map(item => item.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {filteredInfluencers.map((item) => (
                                <SortableInfluencerRow
                                  key={item.id}
                                  item={item}
                                  formatPrice={formatPrice}
                                  getStatusBadge={getStatusBadge}
                                  toggleVisibility={toggleVisibility}
                                  openEditModal={openEditModal}
                                  confirmDelete={confirmDelete}
                                />
                              ))}
                            </SortableContext>
                          </tbody>
                        </table>
                      </DndContext>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Billboards Tab */}
              <TabsContent value="billboards">
                <Card className="border-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Billboards ({filteredBillboards.length})</CardTitle>
                    <Button onClick={() => openCreateModal('billboard')} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" /> Add New
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <AdminSearchBar
                      value={searchQueries.billboards}
                      onChange={(q) => updateSearchQuery('billboards', q)}
                      placeholder="Search by name, type, location..."
                      resultCount={filteredBillboards.length}
                      totalCount={billboards.length}
                    />
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
                          {filteredBillboards.map((item) => (
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

              {/* LED Config Tab */}
              <TabsContent value="ledconfig">
                <LEDConfigTab
                  states={ledStates}
                  sizes={ledSizes}
                  packages={ledPackages}
                  onRefresh={fetchAllData}
                />
              </TabsContent>

              {/* Static/Lightbox Config Tab */}
              <TabsContent value="staticconfig">
                <StaticBillboardConfigTab
                  states={ledStates}
                  billboardTypes={billboardTypes}
                  staticPackages={staticPackages}
                  onRefresh={fetchAllData}
                />
              </TabsContent>

              {/* Independent/Custom Billboard Types Tab */}
              <TabsContent value="independentconfig">
                <IndependentBillboardConfigTab
                  states={ledStates}
                  independentTypes={independentTypes}
                  independentPackages={independentPackages}
                  onRefresh={fetchAllData}
                />
              </TabsContent>

              {/* Kannywood Tab */}
              <TabsContent value="kannywood">
                <Card className="border-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Kannywood Productions ({filteredKannywood.length})</CardTitle>
                    <Button onClick={() => openCreateModal('kannywood')} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" /> Add New
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <AdminSearchBar
                      value={searchQueries.kannywood}
                      onChange={(q) => updateSearchQuery('kannywood', q)}
                      placeholder="Search by title, director, genre, production company..."
                      resultCount={filteredKannywood.length}
                      totalCount={kannywood.length}
                    />
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-semibold">Title</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Director</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Genre</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Price</th>
                            <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Visible</th>
                            <th className="text-center py-3 px-2 text-sm font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredKannywood.map((item) => (
                            <tr key={item.id} className={`border-b hover:bg-muted/30 ${item.visible === false ? 'opacity-50 bg-muted/20' : ''}`}>
                              <td className="py-3 px-2 font-medium text-sm">{item.title}</td>
                              <td className="py-3 px-2 text-sm">{item.director}</td>
                              <td className="py-3 px-2 text-sm">{item.genre}</td>
                              <td className="py-3 px-2 text-sm font-semibold">{formatPrice(item.price)}</td>
                              <td className="py-3 px-2">{getStatusBadge(item.status)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => toggleVisibility('kannywood', item)}
                                    title={item.visible === false ? "Show to users" : "Hide from users"}
                                  >
                                    {item.visible === false ? (
                                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-green-600" />
                                    )}
                                  </Button>
                                </div>
                              </td>
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
                    <CardTitle>Manage Digital Ad Platforms ({filteredDigitalAds.length})</CardTitle>
                    <Button onClick={() => openCreateModal('digitalad')} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" /> Add Platform
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <AdminSearchBar
                      value={searchQueries.digitalAds}
                      onChange={(q) => updateSearchQuery('digitalAds', q)}
                      placeholder="Search by platform name, service name..."
                      resultCount={filteredDigitalAds.length}
                      totalCount={digitalAds.length}
                    />
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
                          {filteredDigitalAds.map((item) => (
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
                    <CardTitle>Manage Consultations ({filteredConsultations.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AdminSearchBar
                      value={searchQueries.consultations}
                      onChange={(q) => updateSearchQuery('consultations', q)}
                      placeholder="Search by business name, contact name, email, phone, industry..."
                      resultCount={filteredConsultations.length}
                      totalCount={consultations.length}
                    />
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
                          {filteredConsultations.map((item) => (
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
                    <div className="flex items-center justify-between">
                      <CardTitle>All Orders ({filteredOrders.length})</CardTitle>
                      {selectedOrders.length > 0 && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setShowBulkDeleteConfirm(true)}
                          data-testid="bulk-delete-orders-btn"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Selected ({selectedOrders.length})
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <AdminSearchBar
                      value={searchQueries.orders}
                      onChange={(q) => updateSearchQuery('orders', q)}
                      placeholder="Search by order ID, customer name, email, phone, package..."
                      resultCount={filteredOrders.length}
                      totalCount={orders.length}
                    />
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left py-3 px-2">
                              <input
                                type="checkbox"
                                checked={filteredOrders.slice(0, 100).length > 0 && filteredOrders.slice(0, 100).every(o => selectedOrders.includes(o.id))}
                                onChange={toggleAllOrdersSelection}
                                className="h-4 w-4 rounded border-gray-300"
                                data-testid="select-all-orders"
                              />
                            </th>
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
                          {filteredOrders.slice(0, 100).map((item) => (
                            <tr key={item.id} className={`border-b hover:bg-muted/30 ${selectedOrders.includes(item.id) ? 'bg-blue-50' : ''}`}>
                              <td className="py-3 px-2">
                                <input
                                  type="checkbox"
                                  checked={selectedOrders.includes(item.id)}
                                  onChange={() => toggleOrderSelection(item.id)}
                                  className="h-4 w-4 rounded border-gray-300"
                                  data-testid={`select-order-${item.id}`}
                                />
                              </td>
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
                                <p className="text-sm">{formatDateTime(item.created_at)}</p>
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
                                    variant="outline" 
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => viewOrderDetails(item)}
                                    data-testid={`view-order-${item.id}`}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
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
                    <CardTitle>Manage Users ({filteredUsers.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AdminSearchBar
                      value={searchQueries.users}
                      onChange={(q) => updateSearchQuery('users', q)}
                      placeholder="Search by name, email, phone, role, company..."
                      resultCount={filteredUsers.length}
                      totalCount={users.length}
                    />
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
                          {filteredUsers.map((item) => (
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

              {/* Branding Tab */}
              <TabsContent value="branding">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Image className="h-5 w-5 mr-2" />
                      Branding & Logo Management
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Upload and manage your brand assets. These will be used across the web and mobile applications.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {/* Web Branding */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Monitor className="h-4 w-4 mr-2" />
                        Web Application
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <ImageUpload
                            label="Website Logo (Header/Footer)"
                            value={settings?.web_logo_url || ''}
                            onChange={(url) => setSettings(prev => ({ ...prev, web_logo_url: url }))}
                            placeholder="Logo displayed in website header and footer"
                          />
                          <p className="text-xs text-muted-foreground">Recommended: 400x120px, PNG with transparent background</p>
                        </div>
                        <div className="space-y-2">
                          <ImageUpload
                            label="Favicon"
                            value={settings?.favicon_url || ''}
                            onChange={(url) => setSettings(prev => ({ ...prev, favicon_url: url }))}
                            placeholder="Browser tab icon"
                          />
                          <p className="text-xs text-muted-foreground">Recommended: 32x32px or 64x64px, PNG/ICO</p>
                        </div>
                      </div>
                    </div>

                    {/* Mobile App Branding */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Package className="h-4 w-4 mr-2" />
                        Mobile Application
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <ImageUpload
                            label="App Icon"
                            value={settings?.app_icon_url || ''}
                            onChange={(url) => setSettings(prev => ({ ...prev, app_icon_url: url }))}
                            placeholder="Mobile app icon"
                          />
                          <p className="text-xs text-muted-foreground">Recommended: 1024x1024px, PNG (no transparency for iOS)</p>
                        </div>
                        <div className="space-y-2">
                          <ImageUpload
                            label="Splash Screen Logo"
                            value={settings?.splash_logo_url || ''}
                            onChange={(url) => setSettings(prev => ({ ...prev, splash_logo_url: url }))}
                            placeholder="Logo shown on app launch"
                          />
                          <p className="text-xs text-muted-foreground">Recommended: 512x512px, PNG with transparent background</p>
                        </div>
                        <div className="space-y-2">
                          <ImageUpload
                            label="Login Screen Logo"
                            value={settings?.login_logo_url || ''}
                            onChange={(url) => setSettings(prev => ({ ...prev, login_logo_url: url }))}
                            placeholder="Logo displayed on login page"
                          />
                          <p className="text-xs text-muted-foreground">Recommended: 400x200px, PNG with transparent background</p>
                        </div>
                        <div className="space-y-2">
                          <ImageUpload
                            label="Notification Icon"
                            value={settings?.notification_icon_url || ''}
                            onChange={(url) => setSettings(prev => ({ ...prev, notification_icon_url: url }))}
                            placeholder="Push notification icon"
                          />
                          <p className="text-xs text-muted-foreground">Recommended: 96x96px, PNG (monochrome for Android)</p>
                        </div>
                      </div>
                    </div>

                    {/* General Logo */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Lightbulb className="h-4 w-4 mr-2" />
                        General Branding
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <ImageUpload
                            label="Primary Logo (Full Color)"
                            value={settings?.primary_logo_url || ''}
                            onChange={(url) => setSettings(prev => ({ ...prev, primary_logo_url: url }))}
                            placeholder="Main brand logo"
                          />
                          <p className="text-xs text-muted-foreground">Your main logo for general use</p>
                        </div>
                        <div className="space-y-2">
                          <ImageUpload
                            label="Logo (White/Light Version)"
                            value={settings?.logo_light_url || ''}
                            onChange={(url) => setSettings(prev => ({ ...prev, logo_light_url: url }))}
                            placeholder="Logo for dark backgrounds"
                          />
                          <p className="text-xs text-muted-foreground">White or light-colored logo for dark backgrounds</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t">
                      <Button 
                        onClick={async () => {
                          try {
                            await api.put('/admin/settings', settings);
                            toast.success('Branding assets saved successfully');
                          } catch (error) {
                            toast.error('Failed to save branding assets');
                          }
                        }}
                        className="bg-accent hover:bg-accent/90"
                      >
                        Save Branding Assets
                      </Button>
                      <p className="text-sm text-muted-foreground self-center">
                        Note: Mobile app assets require an app update to take effect.
                      </p>
                    </div>
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
                <div>
                  <Label>Profile Link (Social Media URL)</Label>
                  <Input 
                    value={formData.profile_link || ''} 
                    onChange={(e) => updateFormField('profile_link', e.target.value)} 
                    placeholder="https://instagram.com/username or https://tiktok.com/@username"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    External link to the influencer's social media profile. This makes the platform badge clickable.
                  </p>
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
                
                {/* Completion Proof Upload - Only show when status is completed */}
                {(formData.order_status === 'completed' || selectedItem?.order_status === 'completed') && (
                  <div className="border-t pt-4 mt-4">
                    <ProofUrlInput
                      value={formData.completion_proof || []}
                      onChange={(proofs) => updateFormField('completion_proof', proofs)}
                      label="Completion Proof (Photos/Videos)"
                      maxItems={10}
                    />
                    <p className="text-xs text-muted-foreground mt-2">Add URLs to images or videos (e.g., Google Drive, YouTube) as proof of completed work</p>
                  </div>
                )}
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

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              Confirm Bulk Delete
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete <span className="font-bold text-red-600">{selectedOrders.length} order(s)</span>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
            <Button onClick={handleBulkDeleteOrders} disabled={bulkDeleting} className="bg-red-600 hover:bg-red-700">
              {bulkDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete {selectedOrders.length} Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Modal */}
      <Dialog open={showOrderDetail} onOpenChange={setShowOrderDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="order-detail-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShoppingBag className="h-5 w-5 text-accent" />
              Order Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="font-mono font-semibold">#{selectedOrder.id?.slice(0, 12).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p className="font-semibold">{formatDateTime(selectedOrder.created_at)}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  CUSTOMER INFORMATION
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedOrder.user_info?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedOrder.user_info?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedOrder.user_info?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Order Type</p>
                    <Badge className={selectedOrder.order_type === 'consultation' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                      {selectedOrder.order_type === 'consultation' ? 'Consultation' : 'Service Order'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Package Details Card - Similar to Cart View */}
              <div className="border-2 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-3 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-accent" />
                    Package Details
                  </h3>
                </div>
                <div className="p-4">
                  <div className="flex gap-4">
                    {/* Package Image */}
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex-shrink-0 border-2 border-accent/20">
                      {selectedOrder.package_details?.image_url ? (
                        <img 
                          src={selectedOrder.package_details.image_url} 
                          alt="Package" 
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    {/* Package Info */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-lg">{selectedOrder.package_details?.packageTitle || selectedOrder.package_details?.title || 'Package'}</h4>
                          <p className="text-sm text-muted-foreground capitalize">
                            {selectedOrder.listing_type?.replace(/_/g, ' ')} 
                            {selectedOrder.package_details?.seller_name && ` - ${selectedOrder.package_details.seller_name}`}
                            {selectedOrder.package_details?.handle && ` (${selectedOrder.package_details.handle})`}
                          </p>
                        </div>
                        <p className="font-bold text-xl text-accent">{formatPrice(selectedOrder.supplier_payout || selectedOrder.package_details?.price || (selectedOrder.total_amount - (selectedOrder.platform_fee || 0)))}</p>
                      </div>

                      {/* Deliverables */}
                      {selectedOrder.package_details?.deliverables && (
                        <div className="mt-3 space-y-1">
                          {(Array.isArray(selectedOrder.package_details.deliverables) 
                            ? selectedOrder.package_details.deliverables 
                            : selectedOrder.package_details.deliverables.split(',').map(d => d.trim())
                          ).slice(0, 4).map((deliverable, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span className="text-muted-foreground">{deliverable}</span>
                            </div>
                          ))}
                          {(Array.isArray(selectedOrder.package_details.deliverables) 
                            ? selectedOrder.package_details.deliverables.length > 4
                            : selectedOrder.package_details.deliverables.split(',').length > 4
                          ) && (
                            <p className="text-xs text-muted-foreground ml-6">+ more deliverables</p>
                          )}
                        </div>
                      )}

                      {/* Additional Package Info */}
                      <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-sm">
                        {selectedOrder.package_details?.turnaround && (
                          <div>
                            <span className="text-muted-foreground">Turnaround:</span>
                            <span className="ml-1 font-medium">{selectedOrder.package_details.turnaround}</span>
                          </div>
                        )}
                        {selectedOrder.package_details?.duration && (
                          <div>
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="ml-1 font-medium">{selectedOrder.package_details.duration}</span>
                          </div>
                        )}
                        {selectedOrder.package_details?.location && (
                          <div>
                            <span className="text-muted-foreground">Location:</span>
                            <span className="ml-1 font-medium">{selectedOrder.package_details.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consultation-specific info - Show ALL form fields */}
              {selectedOrder.order_type === 'consultation' && (
                <div className="bg-purple-50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-sm text-purple-700 border-b border-purple-200 pb-2">CONSULTATION FORM DETAILS</h3>
                  
                  {/* Business Information */}
                  <div>
                    <h4 className="text-xs font-semibold text-purple-600 mb-2 uppercase tracking-wider">Business Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-white/60 rounded p-2">
                        <p className="text-xs text-muted-foreground">Business Name</p>
                        <p className="font-medium">{selectedOrder.package_details?.business_name || 'N/A'}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2">
                        <p className="text-xs text-muted-foreground">Industry</p>
                        <p className="font-medium">{selectedOrder.package_details?.industry || 'N/A'}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2">
                        <p className="text-xs text-muted-foreground">Business Stage</p>
                        <p className="font-medium capitalize">{selectedOrder.package_details?.business_stage?.replace(/-/g, ' ') || 'N/A'}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2">
                        <p className="text-xs text-muted-foreground">Budget Range</p>
                        <p className="font-medium capitalize">{selectedOrder.package_details?.budget_range?.replace(/-/g, ' ') || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Business Description */}
                  {selectedOrder.package_details?.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-purple-600 mb-2 uppercase tracking-wider">What does your business do?</h4>
                      <div className="bg-white/60 rounded p-3">
                        <p className="text-sm">{selectedOrder.package_details.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Advertising Goals */}
                  {selectedOrder.package_details?.goals && (
                    <div>
                      <h4 className="text-xs font-semibold text-purple-600 mb-2 uppercase tracking-wider">Advertising Goals</h4>
                      <div className="bg-white/60 rounded p-3">
                        <p className="text-sm">{selectedOrder.package_details.goals}</p>
                      </div>
                    </div>
                  )}

                  {/* Consultation Details */}
                  <div>
                    <h4 className="text-xs font-semibold text-purple-600 mb-2 uppercase tracking-wider">Consultation Details</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-white/60 rounded p-2">
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="font-medium capitalize">{selectedOrder.package_details?.consultation_type === 'physical' ? '🏢 In-Office' : '💻 Online'}</p>
                      </div>
                      {selectedOrder.preferred_date && (
                        <div className="bg-white/60 rounded p-2">
                          <p className="text-xs text-muted-foreground">Preferred Date</p>
                          <p className="font-medium">{selectedOrder.preferred_date}</p>
                        </div>
                      )}
                      {selectedOrder.preferred_time && (
                        <div className="bg-white/60 rounded p-2">
                          <p className="text-xs text-muted-foreground">Preferred Time</p>
                          <p className="font-medium">{selectedOrder.preferred_time}</p>
                        </div>
                      )}
                      {selectedOrder.scheduled_date && (
                        <div className="bg-green-100 rounded p-2 border border-green-300">
                          <p className="text-xs text-green-700">Confirmed Schedule</p>
                          <p className="font-semibold text-green-800">{selectedOrder.scheduled_date} {selectedOrder.scheduled_time}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h4 className="text-xs font-semibold text-purple-600 mb-2 uppercase tracking-wider">Contact Information</h4>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-white/60 rounded p-2">
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedOrder.package_details?.contact_name || selectedOrder.user_info?.name || 'N/A'}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium text-xs break-all">{selectedOrder.package_details?.contact_email || selectedOrder.user_info?.email || 'N/A'}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium">{selectedOrder.package_details?.contact_phone || selectedOrder.user_info?.phone || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3 opacity-90">ORDER SUMMARY</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="opacity-80">Subtotal (Package Price)</span>
                    <span>{formatPrice(selectedOrder.supplier_payout || selectedOrder.package_details?.price || (selectedOrder.total_amount - (selectedOrder.platform_fee || 0)))}</span>
                  </div>
                  {selectedOrder.platform_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="opacity-80">Platform Fee</span>
                      <span>{formatPrice(selectedOrder.platform_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-white/20 text-lg font-bold">
                    <span>Total</span>
                    <span>{formatPrice(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">ORDER STATUS</p>
                  {getStatusBadge(selectedOrder.order_status)}
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">PAYMENT STATUS</p>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedOrder.payment_status)}
                    {selectedOrder.payment_method && (
                      <span className="text-xs text-muted-foreground capitalize">({selectedOrder.payment_method})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Completion Proof Section */}
              {selectedOrder.order_status === 'completed' && (
                <div className="border rounded-lg p-4 mt-4">
                  <p className="text-sm font-semibold mb-3">Completion Proof</p>
                  {selectedOrder.completion_proof && selectedOrder.completion_proof.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedOrder.completion_proof.map((proof, idx) => (
                        <div key={idx} className="relative aspect-video rounded overflow-hidden bg-muted">
                          {proof.type === 'video' ? (
                            <video src={proof.url} controls className="w-full h-full object-cover" />
                          ) : (
                            <img src={proof.url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-3">No proof uploaded yet</p>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => {
                      setShowOrderDetail(false);
                      openEditModal(selectedOrder?.order_type === 'consultation' ? 'consultation' : 'order', selectedOrder);
                    }}
                  >
                    <Image className="h-4 w-4 mr-2" />
                    {selectedOrder.completion_proof?.length > 0 ? 'Update Proof' : 'Upload Proof'}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowOrderDetail(false)}>Close</Button>
            <Button 
              onClick={() => {
                setShowOrderDetail(false);
                openEditModal(selectedOrder?.order_type === 'consultation' ? 'consultation' : 'order', selectedOrder);
              }}
              className="bg-accent hover:bg-accent/90"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
