import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Loader2,
  Package,
  CheckCircle,
  Clock,
  CreditCard,
  AlertCircle,
  XCircle,
  MessageSquare,
  FileText,
  RefreshCw,
  Calendar,
  MapPin,
  User,
  Phone,
  Mail,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchTracking();
  }, [user, orderId, navigate]);

  const fetchTracking = async () => {
    try {
      const response = await api.get(`/orders/${orderId}/tracking`);
      setTracking(response.data);
    } catch (error) {
      toast.error('Failed to load order tracking');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status, completed, isCancelled, isDisputed) => {
    if (isCancelled) return <XCircle className="h-6 w-6 text-red-500" />;
    if (isDisputed) return <AlertCircle className="h-6 w-6 text-amber-500" />;
    if (completed) return <CheckCircle className="h-6 w-6 text-green-500" />;
    
    const icons = {
      placed: <Package className="h-6 w-6" />,
      paid: <CreditCard className="h-6 w-6" />,
      payment_pending: <CreditCard className="h-6 w-6" />,
      accepted: <CheckCircle className="h-6 w-6" />,
      in_progress: <RefreshCw className="h-6 w-6" />,
      proof_submitted: <FileText className="h-6 w-6" />,
      completed: <CheckCircle className="h-6 w-6" />,
      submitted: <Package className="h-6 w-6" />,
      scheduled: <Calendar className="h-6 w-6" />,
    };
    return icons[status] || <Clock className="h-6 w-6" />;
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: { class: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Pending' },
      accepted: { class: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Accepted' },
      in_progress: { class: 'bg-purple-100 text-purple-800 border-purple-200', label: 'In Progress' },
      proof_submitted: { class: 'bg-cyan-100 text-cyan-800 border-cyan-200', label: 'Proof Submitted' },
      completed: { class: 'bg-green-100 text-green-800 border-green-200', label: 'Completed' },
      cancelled: { class: 'bg-red-100 text-red-800 border-red-200', label: 'Cancelled' },
      disputed: { class: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Disputed' },
      scheduled: { class: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Scheduled' },
    };
    const variant = variants[status] || { class: 'bg-gray-100 text-gray-800', label: status };
    return (
      <Badge className={`${variant.class} border font-medium`}>
        {variant.label}
      </Badge>
    );
  };

  const getPaymentBadge = (status) => {
    const variants = {
      pending: { class: 'bg-amber-100 text-amber-800', label: 'Payment Pending' },
      paid: { class: 'bg-green-100 text-green-800', label: 'Paid' },
      pending_cash: { class: 'bg-orange-100 text-orange-800', label: 'Cash Pending' },
      refunded: { class: 'bg-gray-100 text-gray-800', label: 'Refunded' },
    };
    const variant = variants[status] || { class: 'bg-gray-100', label: status };
    return (
      <Badge className={`${variant.class} font-medium`}>
        <CreditCard className="h-3 w-3 mr-1" />
        {variant.label}
      </Badge>
    );
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
          <p className="text-muted-foreground mb-4">
            We couldn't find the order you're looking for.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { order, listing_info, timeline, type, customer_info } = tracking;
  const isConsultation = type === 'consultation';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-background" data-testid="order-tracking-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Order Summary Card */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                {listing_info?.image_url ? (
                  <img
                    src={listing_info.image_url}
                    alt={listing_info.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-muted flex items-center justify-center">
                    {isConsultation ? (
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                    {isConsultation 
                      ? listing_info?.name 
                      : order?.package_details?.title || listing_info?.name || 'Order'}
                  </h1>
                  <p className="text-muted-foreground">
                    {isConsultation ? listing_info?.business_name : listing_info?.platform || listing_info?.location}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isConsultation ? 'Consultation' : 'Order'} #{order?.id?.substring(0, 8)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(order?.order_status || order?.status)}
                {!isConsultation && getPaymentBadge(order?.payment_status)}
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-lg font-bold text-primary">
                  {formatPrice(order?.total_amount || order?.price || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Date</p>
                <p className="font-medium">{formatDate(order?.created_at)}</p>
              </div>
              {!isConsultation && order?.package_details?.turnaround && (
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{order.package_details.turnaround}</p>
                </div>
              )}
              {isConsultation && order?.scheduled_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="font-medium">{formatDate(order.scheduled_date)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Payment</p>
                <p className="font-medium capitalize">{order?.payment_method || 'Online'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information Card (Admin Only) */}
        {isAdmin && customer_info && (
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer Name</p>
                  <p className="font-medium">{customer_info.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${customer_info.email}`} className="font-medium text-accent hover:underline">
                      {customer_info.email}
                    </a>
                  </div>
                </div>
                {customer_info.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${customer_info.phone}`} className="font-medium text-accent hover:underline">
                        {customer_info.phone}
                      </a>
                    </div>
                  </div>
                )}
                {customer_info.company_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-medium">{customer_info.company_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Customer Since</p>
                  <p className="font-medium">{formatDate(customer_info.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              Order Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {timeline.map((item, index) => {
                const isLast = index === timeline.length - 1;
                const isCancelled = item.is_cancelled;
                const isDisputed = item.is_disputed;
                
                return (
                  <div key={item.status} className="flex gap-4 pb-8 last:pb-0">
                    {/* Line */}
                    {!isLast && (
                      <div className={`absolute left-[19px] top-10 w-0.5 h-[calc(100%-40px)] ${
                        item.completed ? 'bg-green-500' : 'bg-muted'
                      }`} style={{ top: `${index * 80 + 40}px`, height: '40px' }} />
                    )}
                    
                    {/* Icon */}
                    <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      item.completed 
                        ? isCancelled 
                          ? 'bg-red-100' 
                          : isDisputed 
                            ? 'bg-amber-100' 
                            : 'bg-green-100'
                        : 'bg-muted'
                    }`}>
                      {getStatusIcon(item.status, item.completed, isCancelled, isDisputed)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${
                          item.completed 
                            ? isCancelled 
                              ? 'text-red-700' 
                              : isDisputed 
                                ? 'text-amber-700' 
                                : 'text-foreground'
                            : 'text-muted-foreground'
                        }`}>
                          {item.title}
                        </h4>
                        {item.completed && !isCancelled && !isDisputed && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(item.date)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Package Details */}
        {!isConsultation && order?.package_details?.deliverables && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                Package Deliverables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {order.package_details.deliverables.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Consultation Details */}
        {isConsultation && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" />
                Consultation Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Business Name</p>
                  <p className="font-medium">{order?.business_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Industry</p>
                  <p className="font-medium">{order?.industry}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{order?.consultation_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Budget Range</p>
                  <p className="font-medium">{order?.budget_range}</p>
                </div>
              </div>
              {order?.goals && (
                <div>
                  <p className="text-sm text-muted-foreground">Goals</p>
                  <p className="text-sm mt-1">{order.goals}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/messages?id=${orderId}`)}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Send Message
          </Button>
          {order?.proof_url && (
            <Button
              variant="outline"
              onClick={() => window.open(order.proof_url, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Proof
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={fetchTracking}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
