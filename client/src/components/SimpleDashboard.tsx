import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";

type TabType = "overview" | "properties" | "tenants" | "payments" | "reports";

export default function SimpleDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const handleLogout = () => {
    logout();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div
            id="overview-panel"
            role="tabpanel"
            aria-labelledby="overview-tab"
            className="bg-white shadow rounded-lg"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Dashboard Overview
              </h3>
              <div className="text-sm text-gray-600 space-y-4">
                <p>
                  Welcome to your Rent Management System dashboard! Here you can:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Manage your properties and rental units</li>
                  <li>Track tenant information and lease agreements</li>
                  <li>Process payments and monitor financial performance</li>
                  <li>Generate reports and analytics</li>
                  <li>Handle maintenance requests and communications</li>
                </ul>
                <div className="mt-6 p-4 bg-blue-50 rounded-md">
                  <p className="text-blue-800">
                    <strong>Authentication Status:</strong> You are successfully logged in as {user?.email || 'User'}
                  </p>
                  <p className="text-blue-600 mt-1">
                    User Role: {user?.role || 'Landlord'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      
      case "properties":
        return (
          <div
            id="properties-panel"
            role="tabpanel"
            aria-labelledby="properties-tab"
            className="bg-white shadow rounded-lg"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Properties Management
              </h3>
              <div className="text-sm text-gray-600 space-y-4">
                <p>Manage your rental properties and units.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Sunset Apartments</h4>
                    <p className="text-gray-600">123 Main St - 12 units</p>
                    <p className="text-green-600">10 occupied, 2 vacant</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Oak Villa Complex</h4>
                    <p className="text-gray-600">456 Oak Ave - 8 units</p>
                    <p className="text-green-600">7 occupied, 1 vacant</p>
                  </div>
                </div>
                <Button className="mt-4">Add New Property</Button>
              </div>
            </div>
          </div>
        );
      
      case "tenants":
        return (
          <div
            id="tenants-panel"
            role="tabpanel"
            aria-labelledby="tenants-tab"
            className="bg-white shadow rounded-lg"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Tenant Management
              </h3>
              <div className="text-sm text-gray-600 space-y-4">
                <p>View and manage tenant information and lease agreements.</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          John Smith
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          Apt 101
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          Sarah Johnson
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          Apt 202
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <Button className="mt-4">Add New Tenant</Button>
              </div>
            </div>
          </div>
        );
      
      case "payments":
        return (
          <div
            id="payments-panel"
            role="tabpanel"
            aria-labelledby="payments-tab"
            className="bg-white shadow rounded-lg"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Payment Management
              </h3>
              <div className="text-sm text-gray-600 space-y-4">
                <p>Track rent payments and manage financial transactions.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800">Collected This Month</h4>
                    <p className="text-2xl font-bold text-green-900">KES 380,000</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800">Pending</h4>
                    <p className="text-2xl font-bold text-yellow-900">KES 70,000</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-800">Overdue</h4>
                    <p className="text-2xl font-bold text-red-900">KES 25,000</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Recent Payments</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>John Smith - Apt 101</span>
                      <span className="text-green-600 font-medium">KES 25,000</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Sarah Johnson - Apt 202</span>
                      <span className="text-green-600 font-medium">KES 30,000</span>
                    </div>
                  </div>
                </div>
                <Button className="mt-4">Record Payment</Button>
              </div>
            </div>
          </div>
        );
      
      case "reports":
        return (
          <div
            id="reports-panel"
            role="tabpanel"
            aria-labelledby="reports-tab"
            className="bg-white shadow rounded-lg"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Reports & Analytics
              </h3>
              <div className="text-sm text-gray-600 space-y-4">
                <p>Generate reports and view analytics for your properties.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                    <h4 className="font-medium text-gray-900">Monthly Revenue Report</h4>
                    <p className="text-gray-600">View income and expenses breakdown</p>
                  </div>
                  <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                    <h4 className="font-medium text-gray-900">Occupancy Report</h4>
                    <p className="text-gray-600">Track vacancy rates and trends</p>
                  </div>
                  <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                    <h4 className="font-medium text-gray-900">Tenant Report</h4>
                    <p className="text-gray-600">Tenant history and payment records</p>
                  </div>
                  <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                    <h4 className="font-medium text-gray-900">Maintenance Report</h4>
                    <p className="text-gray-600">Track maintenance requests and costs</p>
                  </div>
                </div>
                <Button className="mt-4">Generate Custom Report</Button>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
  };

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "properties" as const, label: "Properties" },
    { id: "tenants" as const, label: "Tenants" },
    { id: "payments" as const, label: "Payments" },
    { id: "reports" as const, label: "Reports" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🏠 Rent Management Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Welcome back, {user?.email || 'User'}!
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {user?.email || 'User'}
                </span>
              </div>
              {/* Logout Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <span>Logout</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8" role="tablist" aria-label="Dashboard sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Properties</dt>
                    <dd className="text-lg font-medium text-gray-900">5</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Tenants</dt>
                    <dd className="text-lg font-medium text-gray-900">12</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"></path>
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Monthly Revenue</dt>
                    <dd className="text-lg font-medium text-gray-900">KES 450,000</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Overdue Payments</dt>
                    <dd className="text-lg font-medium text-gray-900">3</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Tab Content */}
        {renderTabContent()}
      </main>
    </div>
  );
}