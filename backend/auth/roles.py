ROLES = {
    "dm_leader": {
        "permissions": [
            "review:read",
            "review:approve",
            "review:reject",
            "review:edit",
            "smo:trigger",
            "analytics:read",
            "agents:health:summary",
            "library:read",
            "library:write",
            "library:delete",
        ]
    },
    "designer": {
        "permissions": [
            "visual_queue:read",
            "designer_approved:write",
            "assets:upload",
            "library:read",
            "library:write",
            "library:delete",
        ]
    },
    "seo_executive": {
        "permissions": [
            "brief_queue:read",
            "brief_queue:annotate",
            "analytics:seo_read",
            "library:read",
        ]
    },
    "developer": {
        "permissions": [
            "agents:health:full",
            "smo:trigger",
            "analytics:errors",
        ]
    },
    "ceo": {
        "permissions": ["analytics:read_only"]
    },
    "admin": {
        "permissions": ["*"]
    }
}
