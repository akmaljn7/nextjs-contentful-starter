import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useNavigate, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPrice, formatDate } from '@/lib/utils';
import { 
  ShoppingBag, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  XCircle,
  CreditCard,
  Calendar,
  ArrowRight,
  Package,
  Receipt,
  AlertCircle,
  Loader2,
  ChevronRight,
  User,
  Mail,
  Phone,
  FileText,
  RefreshCw,
  Eye,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchDashboardData();
  }, [user, navigate]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, ordersRes, consultationsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/orders'),
        api.get('/consultations').catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setOrders(ordersRes.data);
      setConsultations(consultationsRes.data);
      
      // Combine orders and consultations for transaction history
      const allTransactions = [
        ...ordersRes.data.map(o => ({ ...o, type: 'order' })),
        ...consultationsRes.data.map(c => ({ ...c, type: 'consultation' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setTransactions(allTransactions);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const getStatusBadge = (status) => {
    const variants = {
      pending: { class: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
      accepted: { class: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
      in_progress: { class: 'bg-purple-100 text-purple-800 border-purple-200', icon: RefreshCw },
      proof_submitted: { class: 'bg-green-100 text-green-800 border-green-200', icon: FileText },
      completed: { class: 'bg-green-600 text-white border-green-600', icon: CheckCircle },
      paid: { class: 'bg-green-600 text-white border-green-600', icon: CheckCircle },
      disputed: { class: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
      cancelled: { class: 'bg-gray-100 text-gray-800 border-gray-200', icon: XCircle },
      pending_cash: { class: 'bg-amber-100 text-amber-800 border-amber-200', icon: CreditCard },
      awaiting_payment: { class: 'bg-orange-100 text-orange-800 border-orange-200', icon: CreditCard },
    };
    const variant = variants[status] || { class: 'bg-gray-100 text-gray-800', icon: Clock };
    const Icon = variant.icon;
    return (
      <Badge className={`${variant.class} border font-medium`}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status) => {
    const variants = {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      paid: 'bg-green-100 text-green-800 border-green-200',
      pending_cash: 'bg-orange-100 text-orange-800 border-orange-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      refunded: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return (
      <Badge className={`${variants[status] || 'bg-gray-100'} border text-xs`}>
        {status?.replace(/_/g, ' ') || 'pending'}
      </Badge>
    );
  };

  // Use API stats directly - backend already combines orders + consultations
  // Only fall back to manual calculation if API stats are not available
  const pendingOrders = stats?.pending_orders ?? (
    orders.filter(o => ['pending', 'accepted', 'in_progress', 'awaiting_payment'].includes(o.order_status)).length +
    consultations.filter(c => ['pending', 'scheduled'].includes(c.status)).length
  );
  const completedOrders = stats?.completed_orders ?? (
    orders.filter(o => o.order_status === 'completed').length +
    consultations.filter(c => c.status === 'completed').length
  );
  const cancelledOrders = stats?.cancelled_orders ?? (
    orders.filter(o => o.order_status === 'cancelled').length +
    consultations.filter(c => c.status === 'cancelled').length
  );
  const totalSpent = stats?.total_spent ?? (
    orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.total_amount || 0), 0) +
    consultations.filter(c => c.payment_status === 'paid').reduce((sum, c) => sum + (c.price || 0), 0)
  );
  const totalOrders = stats?.total_orders ?? (orders.length + consultations.length);

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Welcome back, {user.name}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Track your advertising activities and orders
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user.role === 'admin' && (
                <Button
                  onClick={() => navigate('/admin')}
                  className="bg-accent hover:bg-accent/90 text-white h-9"
                  size="sm"
                >
                  Admin Panel
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDashboardData}
                className="h-9"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        ) : (
          <>
            {/* Stats Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <Card className="border-2 hover:shadow-md transition-shadow" data-testid="stat-total-orders">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalOrders}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Orders</p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-shadow" data-testid="stat-pending-orders">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{pendingOrders}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-shadow" data-testid="stat-completed-orders">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{completedOrders}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-shadow" data-testid="stat-cancelled-orders">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{cancelledOrders}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Cancelled</p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-shadow col-span-2 lg:col-span-1" data-testid="stat-total-spent">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-accent/10 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-accent">{formatPrice(totalSpent)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Spent</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
              <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
                <TabsTrigger value="overview" className="data-[state=active]:bg-white text-xs sm:text-sm px-3 sm:px-4 py-2">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-white text-xs sm:text-sm px-3 sm:px-4 py-2">
                  All Orders
                </TabsTrigger>
                <TabsTrigger value="consultations" className="data-[state=active]:bg-white text-xs sm:text-sm px-3 sm:px-4 py-2">
                  Consultations
                </TabsTrigger>
                <TabsTrigger value="transactions" className="data-[state=active]:bg-white text-xs sm:text-sm px-3 sm:px-4 py-2">
                  Transactions
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Recent Orders */}
                  <Card className="lg:col-span-2 border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base sm:text-lg flex items-center">
                          <ShoppingBag className="h-5 w-5 mr-2 text-accent" />
                          Recent Orders
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setActiveTab('orders')}
                          className="text-accent hover:text-accent/80 text-xs sm:text-sm"
                        >
                          View All
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {orders.length === 0 ? (
                        <div className="text-center py-8 sm:py-12">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                          <p className="text-muted-foreground mb-4 text-sm sm:text-base">No orders yet</p>
                          <Button onClick={() => navigate('/influencers')} className="bg-accent hover:bg-accent/90 text-sm">
                            Browse Services
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {orders.slice(0, 4).map((order) => (
                            <div
                              key={order.id}
                              className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                              data-testid={`order-item-${order.id}`}
                            >
                              <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                                    {order.package_details?.packageTitle || order.listing_type?.replace('_', ' ').toUpperCase() || 'Order'}
                                  </p>
                                  <p className="text-xs sm:text-sm text-muted-foreground">
                                    {formatDate(order.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right space-y-1 flex-shrink-0 ml-2">
                                {getStatusBadge(order.order_status)}
                                <p className="text-sm sm:text-base font-bold text-foreground">{formatPrice(order.total_amount)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Actions & Profile */}
                  <div className="space-y-4 sm:space-y-6">
                    {/* Profile Card */}
                    <Card className="border-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg flex items-center">
                          <User className="h-5 w-5 mr-2 text-accent" />
                          Your Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center space-x-3 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{user.name}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{user.phone || 'Not set'}</span>
                        </div>
                        <div className="pt-2 border-t">
                          <Badge className="bg-primary/10 text-primary border-0 capitalize">
                            {user.role === 'user' ? 'Member' : user.role === 'admin' ? 'Admin' : user.role}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="border-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button
                          onClick={() => navigate('/influencers')}
                          variant="outline"
                          className="w-full justify-start h-10 sm:h-11 text-sm"
                        >
                          <User className="h-4 w-4 mr-2 text-accent" />
                          Browse Influencers
                        </Button>
                        <Button
                          onClick={() => navigate('/billboards')}
                          variant="outline"
                          className="w-full justify-start h-10 sm:h-11 text-sm"
                        >
                          <Eye className="h-4 w-4 mr-2 text-accent" />
                          View Billboards
                        </Button>
                        <Button
                          onClick={() => navigate('/digital-ads')}
                          variant="outline"
                          className="w-full justify-start h-10 sm:h-11 text-sm"
                        >
                          <TrendingUp className="h-4 w-4 mr-2 text-accent" />
                          Digital Ads
                        </Button>
                        <Button
                          onClick={() => navigate('/consultation')}
                          className="w-full justify-start h-10 sm:h-11 bg-accent hover:bg-accent/90 text-white text-sm"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Book Consultation
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* All Orders Tab - Combined Service Orders + Consultations */}
              <TabsContent value="orders">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg flex items-center">
                      <Package className="h-5 w-5 mr-2 text-accent" />
                      All Orders ({orders.length + consultations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {orders.length === 0 && consultations.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground mb-4">No orders found</p>
                        <Button onClick={() => navigate('/influencers')} className="bg-accent hover:bg-accent/90">
                          Start Advertising
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-muted-foreground">Type</th>
                              <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-muted-foreground">Order</th>
                              <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-muted-foreground hidden sm:table-cell">Date</th>
                              <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-muted-foreground">Status</th>
                              <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-muted-foreground hidden md:table-cell">Payment</th>
                              <th className="text-right py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-muted-foreground">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Combine and sort orders + consultations by date */}
                            {[
                              ...orders.map(o => ({ ...o, orderType: 'service' })),
                              ...consultations.map(c => ({ 
                                ...c, 
                                orderType: 'consultation',
                                order_status: c.status,
                                total_amount: c.price,
                                package_details: { packageTitle: c.package_title }
                              }))
                            ]
                              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                              .map((item) => (
                              <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-2 sm:px-4">
                                  <Badge 
                                    className={`text-xs ${item.orderType === 'consultation' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} border-0`}
                                  >
                                    {item.orderType === 'consultation' ? 'Consultation' : 'Service'}
                                  </Badge>
                                </td>
                                <td className="py-3 px-2 sm:px-4">
                                  <div>
                                    <p className="font-medium text-foreground text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                                      {item.package_details?.packageTitle || item.listing_type?.replace('_', ' ') || 'Order'}
                                    </p>
                                    {item.orderType === 'consultation' && item.business_name && (
                                      <p className="text-xs text-muted-foreground">{item.business_name}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground sm:hidden">
                                      {formatDate(item.created_at)}
                                    </p>
                                  </div>
                                </td>
                                <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                                  {formatDate(item.created_at)}
                                </td>
                                <td className="py-3 px-2 sm:px-4">
                                  {getStatusBadge(item.order_status)}
                                </td>
                                <td className="py-3 px-2 sm:px-4 hidden md:table-cell">
                                  {getPaymentStatusBadge(item.payment_status)}
                                </td>
                                <td className="py-3 px-2 sm:px-4 text-right">
                                  <span className="font-bold text-foreground text-xs sm:text-sm">
                                    {formatPrice(item.total_amount)}
                                  </span>
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
                    <CardTitle className="text-base sm:text-lg flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-accent" />
                      Consultations ({consultations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {consultations.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground mb-4">No consultations booked yet</p>
                        <Button onClick={() => navigate('/consultation')} className="bg-accent hover:bg-accent/90">
                          Book a Consultation
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {consultations.map((consultation) => (
                          <div
                            key={consultation.id}
                            className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground text-sm sm:text-base">
                                  {consultation.package_title}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                  {consultation.business_name} • {consultation.industry}
                                </p>
                                
                                {/* Show Confirmed Schedule if set */}
                                {consultation.scheduled_date ? (
                                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                                    <p className="text-xs font-semibold text-green-800 flex items-center">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      Confirmed Schedule
                                    </p>
                                    <p className="text-sm font-medium text-green-700">
                                      {formatDate(consultation.scheduled_date)} {consultation.scheduled_time && `at ${consultation.scheduled_time}`}
                                    </p>
                                  </div>
                                ) : consultation.preferred_date ? (
                                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                                    <p className="text-xs font-semibold text-amber-800 flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Requested Schedule (Pending Confirmation)
                                    </p>
                                    <p className="text-sm text-amber-700">
                                      {formatDate(consultation.preferred_date)} {consultation.preferred_time && `at ${consultation.preferred_time}`}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Booked on {formatDate(consultation.created_at)}
                                  </p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                {getStatusBadge(consultation.status || 'pending')}
                                <p className="text-sm sm:text-base font-bold text-foreground mt-1">
                                  {formatPrice(consultation.price)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Transactions Tab */}
              <TabsContent value="transactions">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg flex items-center">
                      <Receipt className="h-5 w-5 mr-2 text-accent" />
                      Transaction History ({transactions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transactions.length === 0 ? (
                      <div className="text-center py-12">
                        <Receipt className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground">No transactions yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transactions.map((transaction, idx) => (
                          <div
                            key={`${transaction.type}-${transaction.id}-${idx}`}
                            className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                transaction.type === 'consultation' ? 'bg-purple-100' : 'bg-accent/10'
                              }`}>
                                {transaction.type === 'consultation' ? (
                                  <MessageSquare className="h-5 w-5 text-purple-600" />
                                ) : (
                                  <ShoppingBag className="h-5 w-5 text-accent" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground text-xs sm:text-sm truncate">
                                  {transaction.type === 'consultation' 
                                    ? transaction.package_title 
                                    : transaction.package_details?.packageTitle || transaction.listing_type?.replace('_', ' ')
                                  }
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatDate(transaction.created_at)}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                    {transaction.type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="font-bold text-foreground text-sm sm:text-base">
                                {formatPrice(transaction.total_amount || transaction.price)}
                              </p>
                              {getPaymentStatusBadge(transaction.payment_status || transaction.status || 'pending')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Help Section */}
            <Card className="mt-6 sm:mt-8 border-2 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-foreground text-base sm:text-lg mb-1">Need Help?</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Our team is here to assist you with your advertising needs
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => navigate('/contact')}
                      className="flex-1 sm:flex-none text-sm"
                    >
                      Contact Us
                    </Button>
                    <Button
                      onClick={() => navigate('/consultation')}
                      className="flex-1 sm:flex-none bg-accent hover:bg-accent/90 text-white text-sm"
                    >
                      Get Expert Advice
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
