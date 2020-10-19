import * as pulumi from "@pulumi/pulumi";
import { createCertificate, registerAutoTags } from "@topmonks/pulumi-aws";
import { createWebsite } from "./www.hlidacshopu.cz";

registerAutoTags({
  "user:Project": pulumi.getProject(),
  "user:Stack": pulumi.getStack()
});

let certificate = createCertificate("www.hlidacshopu.cz");

let {
  assetsCachingLambda,
  securityHeadersLambda,
  nakedDomainRedirect,
  website
} = createWebsite();

export const certificateArn = certificate;
export const assetsCachingLambdaArn = assetsCachingLambda.arn;
export const securityHeadersLambdaArn = securityHeadersLambda.arn;
export const websiteUrl = website.url;
export const websiteS3BucketUri = website.s3BucketUri;
export const websiteS3WebsiteUrl = website.s3WebsiteUrl;
export const websiteCloudFrontId = website.cloudFrontId;
export const nakedDomainRedirectUrl = nakedDomainRedirect.url;
export const nakedDomainRedirectCloudFrontId = nakedDomainRedirect.cloudFrontId;
