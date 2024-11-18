"use client";

import React, { useState, useEffect } from 'react';
import { Folder, File, Trash2, Upload, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";

// S3 Service Implementation
class S3Service {
  constructor() {
    // Validate required environment variables
    const requiredEnvVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      },
      endpoint: process.env.AWS_ENDPOINT || undefined
    });
  }

  async uploadFile(bucket, key, body) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body
    });

    try {
      const response = await this.s3Client.send(command);
      return response;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async downloadFile(bucket, key) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    try {
      const response = await this.s3Client.send(command);
      return response.Body;
    } catch (error) {
      console.error('Error downloading file from S3:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async deleteFile(bucket, key) {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    });

    try {
      const response = await this.s3Client.send(command);
      return response;
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async listObjects(bucket, prefix = '') {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix
    });

    try {
      const response = await this.s3Client.send(command);
      return response.Contents || [];
    } catch (error) {
      console.error('Error listing objects in S3 bucket:', error);
      throw new Error(`Failed to list objects: ${error.message}`);
    }
  }
}

// Utility function to format file size
const formatFileSize = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const S3BucketManager = () => {
  const [buckets, setBuckets] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [objects, setObjects] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const s3Service = new S3Service();

  const fetchObjects = async (bucketName) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedObjects = await s3Service.listObjects(bucketName);
      setObjects(fetchedObjects);
    } catch (error) {
      setError(error.message);
      toast({
        variant: "destructive",
        title: "Error fetching objects",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize with predefined buckets
  useEffect(() => {
    setBuckets([
      { name: process.env.BUCKET_NAME, region: 'eu-central-2' },
    ]);
  }, []);

  // Auto-select first bucket
  useEffect(() => {
    if (buckets.length > 0 && !selectedBucket) {
      setSelectedBucket(buckets[0].name);
    }
  }, [buckets, selectedBucket]);

  // Fetch objects when selected bucket changes
  useEffect(() => {
    if (selectedBucket) {
      fetchObjects(selectedBucket);
    }
  }, [selectedBucket]);

  const handleBucketSelect = (bucketName) => {
    setSelectedBucket(bucketName);
  };

  const handleFileUpload = async () => {
    if (!uploadFile || !selectedBucket) return;

    setIsLoading(true);
    setError(null);
    try {
      await s3Service.uploadFile(selectedBucket, uploadFile.name, uploadFile);
      await fetchObjects(selectedBucket);
      setUploadFile(null);
      toast({
        title: "Success",
        description: "File uploaded successfully"
      });
    } catch (error) {
      setError(error.message);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteObject = async (objectKey) => {
    if (!selectedBucket) return;

    setIsLoading(true);
    setError(null);
    try {
      await s3Service.deleteFile(selectedBucket, objectKey);
      await fetchObjects(selectedBucket);
      toast({
        title: "Success",
        description: "File deleted successfully"
      });
    } catch (error) {
      setError(error.message);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (selectedBucket) {
      fetchObjects(selectedBucket);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>S3 Bucket Manager</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} /> 
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <div className="flex">
          {/* Bucket List */}
          <div className="w-1/4 pr-4 border-r">
            <h3 className="font-semibold mb-2">Buckets</h3>
            <div className="space-y-2">
              {buckets.map((bucket) => (
                <div 
                  key={bucket.name}
                  className={`p-2 cursor-pointer rounded transition-colors ${
                    selectedBucket === bucket.name 
                      ? 'bg-blue-100 border-blue-500 border' 
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => handleBucketSelect(bucket.name)}
                >
                  <Folder className="inline-block mr-2" />
                  {bucket.name}
                  <span className="text-xs text-gray-500 block">{bucket.region}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Object List */}
          <div className="w-3/4 pl-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">
                Objects in {selectedBucket || 'Select a Bucket'}
              </h3>
              
              {/* File Upload Section */}
              <div className="flex items-center space-x-2">
                <Input 
                  type="file" 
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-64"
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleFileUpload} 
                  disabled={!uploadFile || !selectedBucket || isLoading}
                  className="flex items-center"
                >
                  <Upload className="mr-2" /> Upload
                </Button>
              </div>
            </div>

            {/* Objects Table */}
            <div className="border rounded">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-right">Size</th>
                    <th className="p-2 text-right">Last Modified</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="4" className="text-center p-4">
                        Loading...
                      </td>
                    </tr>
                  ) : objects.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center p-4 text-gray-500">
                        No objects in this bucket
                      </td>
                    </tr>
                  ) : (
                    objects.map((object) => (
                      <tr key={object.Key} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <File className="inline-block mr-2 text-blue-500" />
                          {object.Key}
                        </td>
                        <td className="p-2 text-right">
                          {formatFileSize(object.Size)}
                        </td>
                        <td className="p-2 text-right">
                          {new Date(object.LastModified).toLocaleDateString()}
                        </td>
                        <td className="p-2 text-right">
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDeleteObject(object.Key)}
                            disabled={isLoading}
                          >
                            <Trash2 className="mr-2" /> Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default S3BucketManager;