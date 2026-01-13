/**
 * Visitor Detail Modal Component
 * Displays full details of a visitor registration in a dialog
 */
import React from 'react';
import JsBarcode from 'jsbarcode';
import BarcodeGenerator from '../../services/BarcodeService';
import { BACKEND_URL } from '../../services/constants';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Eye, Camera, CreditCard, Calendar, MapPin, Download } from "lucide-react";

const VisitorDetailModal = ({ visitor, isOpen, onClose }) => {
  // Don't render if no visitor selected
  if (!visitor) return null;

  /**
   * Format datetime string for display
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  /**
   * Check if visitor pass is still valid
   */
  const isActive = new Date(visitor.expires_at) > new Date();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-700 flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Visitor Details - {visitor.plate_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Vehicle Information Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-600">Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Plate Number</Label>
                <p className="text-lg font-mono font-bold">{visitor.plate_number}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Vehicle Type</Label>
                <Badge variant="outline" className="ml-2">
                  {visitor.vehicle_type.toUpperCase()}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Purpose of Visit</Label>
                <p className="text-sm">{visitor.purpose_of_visit}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Department Visiting</Label>
                <p className="text-sm">{visitor.department_visiting || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Driver Information Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-600">Driver Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left column - Text info */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Full Name</Label>
                    <p className="font-semibold">
                      {visitor.driver_license.first_name} 
                      {visitor.driver_license.middle_name && ` ${visitor.driver_license.middle_name}`} 
                      {visitor.driver_license.last_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 flex items-center">
                      <CreditCard className="w-4 h-4 mr-1" />
                      License Number
                    </Label>
                    <p className="font-mono text-sm">{visitor.driver_license.license_number}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Gender</Label>
                      <p className="capitalize">{visitor.driver_license.gender}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Date of Birth
                      </Label>
                      <p className="text-sm">{visitor.driver_license.date_of_birth || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      Address
                    </Label>
                    <p className="text-sm">{visitor.driver_license.address}</p>
                  </div>
                </div>

                {/* Right column - License Photo */}
                <div>
                  <Label className="text-sm font-medium text-gray-600">Driver&apos;s License Photo</Label>
                  <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {visitor.driver_license.license_photo_path ? (
                      <div className="text-center">
                        <img 
                          src={`${BACKEND_URL}/uploads/${visitor.driver_license.license_photo_path.split('/').pop()}`}
                          alt="Driver's License"
                          className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                        <div className="hidden text-gray-500">
                          <Camera className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-sm">License photo not available</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        <Camera className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm">No license photo captured</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visit Information Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-600">Visit Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Visit Duration</Label>
                <Badge variant="outline" className="ml-2">
                  {visitor.visit_duration.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Registration Date</Label>
                <p className="text-sm">{formatDate(visitor.created_at)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Expires At</Label>
                <p className="text-sm font-medium text-orange-600">{formatDate(visitor.expires_at)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Status</Label>
                <Badge 
                  variant={isActive ? 'default' : 'destructive'} 
                  className="ml-2"
                >
                  {isActive ? 'ACTIVE' : 'EXPIRED'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Barcode Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-600">Access Barcode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4 mb-4 inline-block">
                  <canvas 
                    ref={(canvas) => {
                      if (canvas && visitor.barcode_data) {
                        JsBarcode(canvas, visitor.barcode_data, {
                          format: 'CODE128',
                          width: 2,
                          height: 60,
                          displayValue: true,
                          fontSize: 12
                        });
                      }
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600">Barcode Data: {visitor.barcode_data}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-end space-x-2 mt-6">
          <Button
            onClick={() => {
              const pdf = BarcodeGenerator.generatePDF(
                visitor.plate_number,
                visitor.barcode_data,
                visitor.expires_at
              );
              pdf.save(`${visitor.plate_number}_visitor_pass.pdf`);
            }}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="download-pass-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Pass
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="close-modal-btn">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VisitorDetailModal;
