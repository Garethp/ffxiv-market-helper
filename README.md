# FF14 Market Tracking Helper

This is a personal project that uses the Universalis API to track market data for Final Fantasy XIV. The goal is to
track the prices of certain items and calculate the profit of flipping items between different worlds/datacenters/regions.

## Try it out

You can try out the app by visiting it here: [https://garethp.github.io/ffxiv-market-helper/](https://garethp.github.io/ffxiv-market-helper/)

## Features

- Configure which items you want to track the profit margin for
- Configure your characters and retainers in different worlds, to check for cross-region pricing differences
- Automatically fetch live data every 90s from Universalis for tracked items
- Scan Universalis to create a list of high-volume items in a given region to look for new items to track

## Setup

1. Install with `yarn install`
2. Create a `personalConfig.ts` file, following `personalConfig.example.ts`
3. Run the app with `yarn start`

## AI Usage

While I'm an experienced software engineer and I'm reviewing the code myself and making sure that the architecture and
tests fit my own opinionated style, this project was almost entirely built with Claude Code.

Documentation (like this README) that's meant to communicate to other people are written by me without AI assistance.
I don't believe that human to human communication should be replaced with AI.
