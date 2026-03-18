import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatPrice, formatDate } from '@/lib/utils';
import { 
  ShoppingBag, 
  Users,
  CheckCircle, 
  Clock, 
  XCircle,
  TrendingUp,
  Package,
  MessageSquare,
  Loader2,
  RefreshCw,
  Edit,
  Eye,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'accepted', label: 'Accepted', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-purple-100 text-purple-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-600 text-white' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
];

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'pending_cash', label: 'Pending Cash', color: 'bg-orange-100 text-orange-800' },
  { value: 'refunded', label: 'Refunded', color: 'bg-gray-100 text-gray-800' },
];

const CONSULTATION_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-600 text-white' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
];

export const AdminPanelPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Status update states
  const [newOrderStatus, setNewOrderStatus] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [newConsultationStatus, setNewConsultationStatus] = useState('');

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
    fetchAdminData();
  }, [user, navigate]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, ordersRes, consultationsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/admin/orders'),
        api.get('/admin/consultations'),
      ]);
      setStats(statsRes.data);
      setOrders(ordersRes.data);
      setConsultations(consultationsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrder = (order) => {
    setSelectedOrder(order);
    setNewOrderStatus(order.order_status || 'pending');
    setNewPaymentStatus(order.payment_status || 'pending');
    setShowOrderModal(true);
  };

  const handleEditConsultation = (consultation) => {
    setSelectedConsultation(consultation);
    setNewConsultationStatus(consultation.status || 'pending');
    setNewPaymentStatus(consultation.payment_status || 'pending');
    setShowConsultationModal(true);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await api.put(`/admin/orders/${selectedOrder.id}/status?order_status=${newOrderStatus}&payment_status=${newPaymentStatus}`);
      toast.success('Order updated successfully');
      setShowOrderModal(false);
      fetchAdminData();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateConsultation = async () => {
    if (!selectedConsultation) return;
    setUpdating(true);
    try {
      await api.put(`/admin/consultations/${selectedConsultation.id}/status?status=${newConsultationStatus}&payment_status=${newPaymentStatus}`);
      toast.success('Consultation updated successfully');
      setShowConsultationModal(false);
      fetchAdminData();
    } catch (error) {
      console.error('Error updating consultation:', error);
      toast.error('Failed to update consultation');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status, statusList) => {
    const statusConfig = statusList.find(s => s.value === status) || statusList[0];
    return (
      <Badge className={`${statusConfig.color} border-0`}>
        {statusConfig.label}
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
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Admin Panel
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Manage orders, consultations, and platform operations
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAdminData}
              className="h-9"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
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
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <Card className="border-2">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats?.total_orders || 0}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Orders</p>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats?.pending_orders || 0}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Pending Orders</p>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats?.total_consultations || 0}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Consultations</p>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-accent">{formatPrice(stats?.total_revenue || 0)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Revenue</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-white">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-white">
                  Orders ({orders.length})
                </TabsTrigger>
                <TabsTrigger value="consultations" className="data-[state=active]:bg-white">
                  Consultations ({consultations.length})
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Orders */}
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center">
                          <ShoppingBag className="h-5 w-5 mr-2 text-accent" />
                          Recent Orders
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('orders')}>
                          View All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {orders.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No orders yet</p>
                      ) : (
                        <div className="space-y-3">
                          {orders.slice(0, 5).map((order) => (
                            <div
                              key={order.id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {order.package_details?.packageTitle || order.listing_type}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {order.user_info?.name || 'Unknown User'} • {formatDate(order.created_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(order.order_status, ORDER_STATUSES)}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditOrder(order)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Consultations */}
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center">
                          <MessageSquare className="h-5 w-5 mr-2 text-purple-600" />
                          Recent Consultations
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('consultations')}>
                          View All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {consultations.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No consultations yet</p>
                      ) : (
                        <div className="space-y-3">
                          {consultations.slice(0, 5).map((consultation) => (
                            <div
                              key={consultation.id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {consultation.package_title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {consultation.business_name} • {formatDate(consultation.created_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(consultation.status || 'pending', CONSULTATION_STATUSES)}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditConsultation(consultation)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-accent" />
                      All Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {orders.length === 0 ? (
                      <p className="text-center text-muted-foreground py-12">No orders found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Order</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Customer</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Date</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Payment</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Amount</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-muted-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map((order) => (
                              <tr key={order.id} className="border-b hover:bg-muted/30">
                                <td className="py-3 px-4">
                                  <p className="font-medium text-sm">
                                    {order.package_details?.packageTitle || order.listing_type?.replace('_', ' ')}
                                  </p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {order.id?.slice(0, 8)}...
                                  </p>
                                </td>
                                <td className="py-3 px-4">
                                  <p className="text-sm font-medium">{order.user_info?.name || 'N/A'}</p>
                                  <p className="text-xs text-muted-foreground">{order.user_info?.email || ''}</p>
                                </td>
                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                  {formatDate(order.created_at)}
                                </td>
                                <td className="py-3 px-4">
                                  {getStatusBadge(order.order_status, ORDER_STATUSES)}
                                </td>
                                <td className="py-3 px-4">
                                  {getStatusBadge(order.payment_status, PAYMENT_STATUSES)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="font-bold">{formatPrice(order.total_amount)}</span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditOrder(order)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Update
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Consultations Tab */}
              <TabsContent value="consultations">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-purple-600" />
                      All Consultations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {consultations.length === 0 ? (
                      <p className="text-center text-muted-foreground py-12">No consultations found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Consultation</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Business</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Contact</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Date</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Price</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-muted-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consultations.map((consultation) => (
                              <tr key={consultation.id} className="border-b hover:bg-muted/30">
                                <td className="py-3 px-4">
                                  <p className="font-medium text-sm">{consultation.package_title}</p>
                                  <p className="text-xs text-muted-foreground">{consultation.consultation_type}</p>
                                </td>
                                <td className="py-3 px-4">
                                  <p className="text-sm font-medium">{consultation.business_name}</p>
                                  <p className="text-xs text-muted-foreground">{consultation.industry}</p>
                                </td>
                                <td className="py-3 px-4">
                                  <p className="text-sm">{consultation.contact_name}</p>
                                  <p className="text-xs text-muted-foreground">{consultation.contact_phone}</p>
                                </td>
                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                  {formatDate(consultation.created_at)}
                                </td>
                                <td className="py-3 px-4">
                                  {getStatusBadge(consultation.status || 'pending', CONSULTATION_STATUSES)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="font-bold">{formatPrice(consultation.price)}</span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditConsultation(consultation)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Update
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Order Update Modal */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="font-medium">{selectedOrder.package_details?.packageTitle || selectedOrder.listing_type}</p>
                <p className="text-sm text-muted-foreground">
                  Customer: {selectedOrder.user_info?.name || 'N/A'}
                </p>
                <p className="text-sm font-bold text-accent mt-1">{formatPrice(selectedOrder.total_amount)}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Order Status</label>
                  <Select value={newOrderStatus} onValueChange={setNewOrderStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Status</label>
                  <Select value={newPaymentStatus} onValueChange={setNewPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOrder} disabled={updating} className="bg-accent hover:bg-accent/90">
              {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Update Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consultation Update Modal */}
      <Dialog open={showConsultationModal} onOpenChange={setShowConsultationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Consultation Status</DialogTitle>
          </DialogHeader>
          {selectedConsultation && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="font-medium">{selectedConsultation.package_title}</p>
                <p className="text-sm text-muted-foreground">
                  Business: {selectedConsultation.business_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Contact: {selectedConsultation.contact_name} - {selectedConsultation.contact_phone}
                </p>
                <p className="text-sm font-bold text-accent mt-1">{formatPrice(selectedConsultation.price)}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Consultation Status</label>
                  <Select value={newConsultationStatus} onValueChange={setNewConsultationStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSULTATION_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Status</label>
                  <Select value={newPaymentStatus} onValueChange={setNewPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsultationModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateConsultation} disabled={updating} className="bg-accent hover:bg-accent/90">
              {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Update Consultation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
