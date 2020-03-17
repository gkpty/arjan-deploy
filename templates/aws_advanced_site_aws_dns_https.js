module.exports = function genTemplate(DomainName, index, error){
  if(!index){
    index = 'index.html'
  }
  if(!error){
    error = 'error.html'
  }
  let template = {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Resources": {
      "RootBucket": {
          "Type": "AWS::S3::Bucket",
          "Properties": {
            "AccesControl": "PublicRead",
            "BucketName": DomainName,
            "WebsiteConfiguration": {
              "ErrorDocument" : error.html,
              "IndexDocument" : index.html
            }
          }
      },
      "BucketPolicy": {
          "Type": "AWS::S3::BucketPolicy",
          "Properties": {
              "Bucket": {
                  "Ref": "RootBucket"
              },
              "PolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                  {
                    "Sid": "PublicReadGetObject",
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": "s3:GetObject",
                    "Resource": { "Fn::Join" : ["", ["arn:aws:s3:::", { "Ref" : "RootBucket" } , "/*" ]]}
                  }
                ]
              }
          }
      },
      "WwwBucket": {
          "Type": "AWS::S3::Bucket",
          "Properties": {
            "BucketName": {"Fn::Join" : ["www.", { "Ref" : "RootBucket" }]},
            "WebsiteConfiguration": {
              "RedirectAllRequestsTo": {
                "HostName" : {
                  "Ref": "RootBucket"
                },
                "Protocol" : "https"
              }
            }
          },
          "DependsOn": [
              "RootBucket"
          ]
      },
      "HostedZone": {
          "Type": "AWS::Route53::HostedZone",
          "Properties": {
            "HostedZoneConfig" : {
              "comment": {"Fn::Join" : ["Hosted Zone for ", { "Ref" : "RootBucket" }]}
            },
            "Name" : { "Ref" : "RootBucket" }
          }
      },
      "RecordSet": {
          "Type": "AWS::Route53::RecordSetGroup",
          "Properties": {
              "HostedZoneId": {
                  "Ref": "HostedZone"
              },
              "RecordSets" : [ 
                {
                  "AliasTarget" : {
                    "DNSName" : DnsName,
                    "HostedZoneId" : {"Ref": "HostedZone"}
                  },
                  "Comment" : "Record for root bucket",
                  "HostedZoneId" : {"Ref": "HostedZone"},
                  "Name" : {"Ref":"RootBucket"},
                  "Region" : AWSRegion,
                  "Type" : "A"
                },
                {
                  "AliasTarget" : {
                    "DNSName" : WwwDnsName,
                    "HostedZoneId" : {"Ref": "HostedZone"}
                  },
                  "Comment" : "Record for www bucket",
                  "HostedZoneId" : {"Ref": "HostedZone"},
                  "Name" : {"Ref":"WwwBucket"},
                  "Region" : AWSRegion,
                  "Type" : "A"
                },
                {
                  "AliasTarget" : {
                    "DNSName" : "DnsName",
                    "HostedZoneId" : {"Ref": "HostedZone"}
                  },
                  "Comment" : "Record for root bucket",
                  "HostedZoneId" : {"Ref": "HostedZone"},
                  "Name" : cName,
                  "ResourceRecords": [cValue],
                  "Region" : AWSRegion,
                  "Type" : "CNAME"
                }
              ]
          },
          "DependsOn": [
              "Certificate"
          ]
      },
      "CfDistribution": {
          "Type": "AWS::CloudFront::Distribution",
          "Properties": {
            "DistributionConfig":{
              "Aliases" : [
                { "Ref" : "RootBucket" },
                {"Fn::Join" : ["www.", { "Ref" : "RootBucket" }]}
              ],
              "DefaultCacheBehavior" : {
                "AllowedMethods" : ["GET", "HEAD"],
                "CachedMethods" : ["GET", "HEAD"],
                "Compress" : true,
                "DefaultTTL" : 86400,
                "ForwardedValues" : {
                  "QueryString" : false
                },
                "MaxTTL" : 31536000,
                "MinTTL" : 0,
                "SmoothStreaming" : false,
                "TargetOriginId" : {"Fn::Join" : ["s3-", { "Ref" : "RootBucket" }]},
                "ViewerProtocolPolicy" : "redirect-to-https"
              },
              "DefaultRootObject" : index.html,
              "Enabled" : true,
              "Origins" : [
                {
                  "DomainName" : {"Fn::Join" : [{ "Ref" : "RootBucket" }, ".s3.amazonaws.com"]},
                  "Id" : {"Fn::Join" : ["s3-", { "Ref" : "RootBucket" }]},
                  "S3OriginConfig" : {
                    "OriginAccessIdentity" : ""
                  }
                }
              ],
              "PriceClass" : "PriceClass_All",
              "ViewerCertificate" : {
                "AcmCertificateArn" : {"Ref": "Certificate"},
                "MinimumProtocolVersion" : "TLSv1.1_2016",
                "SslSupportMethod" : "sni-only"
              }
            }
          },
          "DependsOn": [
              "WwwBucket"
          ]
      },
      "Certificate": {
          "Type": "AWS::CertificateManager::Certificate",
          "Properties": {
            "DomainName" : {"Ref":"RootBucket"},
            "DomainValidationOptions" : [ 
              {
                "DomainName": {"Ref":"RootBucket"},
                "ValidationDomain": {"Ref":"RootBucket"}
              } 
            ],
            "SubjectAlternativeNames" : [ {"Fn::Join" : ["*.", { "Ref" : "RootBucket" }]} ],
            "ValidationMethod" : "DNS"
          },
          "DependsOn": [
              "CfDistribution"
          ]
      }
    }
  }
}