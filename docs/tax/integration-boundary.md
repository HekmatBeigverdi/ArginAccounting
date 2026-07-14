# Iranian Taxpayer System Integration Boundary

## Principle

The Iranian Taxpayer System integration must not change the accounting core.

## Source of Truth

The accounting sales invoice is the commercial and accounting source of truth.

## Integration Projection

A separate tax submission document is generated from the sales invoice.

## Responsibilities

The tax integration layer is responsible for:

- Tax data validation
- Product tax identifier mapping
- Buyer tax information mapping
- Tax invoice transformation
- Submission
- Inquiry
- Retry
- Error logging
- UID storage
- Reference number storage

## Separation

The following items must remain outside the accounting invoice tables:

- SDK transport configuration
- Private key information
- Token information
- Request trace ID
- Submission response
- Inquiry response
- Raw request payload
- Raw response payload

## Future Service

The integration will be implemented as a separate ASP.NET Core Web API.
